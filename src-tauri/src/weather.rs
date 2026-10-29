use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::settings::{self, AppSettings};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WeatherInfo {
    pub temperature: f64,
    pub weather_code: i32,
    pub high: f64,
    pub low: f64,
    pub label: String,
    pub icon: String,
}

#[derive(Deserialize)]
struct OpenMeteoResponse {
    current: Option<Current>,
    daily: Option<Daily>,
}

#[derive(Deserialize)]
struct Current {
    temperature_2m: f64,
    weather_code: i32,
}

#[derive(Deserialize)]
struct Daily {
    temperature_2m_max: Vec<f64>,
    temperature_2m_min: Vec<f64>,
}

pub fn weather_icon(code: i32) -> &'static str {
    match code {
        0 => "clear",
        1 | 2 => "partly",
        3 => "cloudy",
        45 | 48 => "fog",
        51 | 53 | 55 | 56 | 57 => "drizzle",
        61 | 63 | 65 | 66 | 67 | 80 | 81 | 82 => "rain",
        71 | 73 | 75 | 77 | 85 | 86 => "snow",
        95 | 96 | 99 => "thunder",
        _ => "cloudy",
    }
}

pub fn fetch_weather(settings: &AppSettings) -> Result<WeatherInfo, String> {
    let url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={}&longitude={}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone={}&forecast_days=1",
        settings.weather_lat,
        settings.weather_lon,
        urlencoding::encode(&settings.weather_timezone)
    );

    let resp: OpenMeteoResponse = reqwest::blocking::get(&url)
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .map_err(|e| e.to_string())?;

    let current = resp.current.ok_or_else(|| "hava verisi yok".to_string())?;
    let high = resp
        .daily
        .as_ref()
        .and_then(|d| d.temperature_2m_max.first().copied())
        .unwrap_or(current.temperature_2m);
    let low = resp
        .daily
        .as_ref()
        .and_then(|d| d.temperature_2m_min.first().copied())
        .unwrap_or(current.temperature_2m);

    Ok(WeatherInfo {
        temperature: current.temperature_2m,
        weather_code: current.weather_code,
        high,
        low,
        label: settings.weather_label.clone(),
        icon: weather_icon(current.weather_code).to_string(),
    })
}

pub struct WeatherState {
    pub last: Mutex<Option<WeatherInfo>>,
    pub reload: Mutex<bool>,
}

impl WeatherState {
    pub fn new() -> Self {
        Self {
            last: Mutex::new(None),
            reload: Mutex::new(true),
        }
    }
}

pub fn start_weather_watcher(app: AppHandle, state: Arc<WeatherState>) {
    thread::spawn(move || {
        loop {
            let force = state.reload.lock().map(|mut g| {
                let v = *g;
                *g = false;
                v
            }).unwrap_or(true);

            let settings = settings::load(&app);
            if settings.show_weather {
                match fetch_weather(&settings) {
                    Ok(info) => {
                        let changed = {
                            let mut last = state.last.lock().unwrap_or_else(|e| e.into_inner());
                            let changed = last.as_ref() != Some(&info);
                            *last = Some(info.clone());
                            changed
                        };
                        if changed || force {
                            let _ = app.emit("weather:update", info);
                        }
                    }
                    Err(e) => eprintln!("[ada] hava: {e}"),
                }
            }

            // 15 dk, ama reload bayrağı için daha sık kontrol
            for _ in 0..90 {
                thread::sleep(Duration::from_secs(10));
                if state.reload.lock().map(|g| *g).unwrap_or(false) {
                    break;
                }
            }
        }
    });
}

#[tauri::command]
pub fn weather_get(state: tauri::State<'_, Arc<WeatherState>>) -> Option<WeatherInfo> {
    state.last.lock().ok().and_then(|g| g.clone())
}

#[tauri::command]
pub fn weather_refresh(state: tauri::State<'_, Arc<WeatherState>>) -> Result<(), String> {
    if let Ok(mut g) = state.reload.lock() {
        *g = true;
    }
    Ok(())
}
