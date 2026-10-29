use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_store::StoreExt;

use crate::weather::WeatherState;
use crate::window;

const STORE: &str = "settings.json";
const KEY: &str = "settings";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub monitor_id: Option<String>,
    pub autostart: bool,
    pub hide_on_fullscreen: bool,
    pub show_media: bool,
    pub show_weather: bool,
    pub show_calendar: bool,
    pub show_battery: bool,
    pub show_clipboard: bool,
    pub show_timer: bool,
    pub weather_lat: f64,
    pub weather_lon: f64,
    pub weather_label: String,
    pub weather_timezone: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            monitor_id: None,
            autostart: true,
            hide_on_fullscreen: false,
            show_media: true,
            show_weather: true,
            show_calendar: true,
            show_battery: true,
            show_clipboard: true,
            show_timer: true,
            weather_lat: 41.01,
            weather_lon: 28.97,
            weather_label: "İstanbul".into(),
            weather_timezone: "Europe/Istanbul".into(),
        }
    }
}

pub fn load(app: &AppHandle) -> AppSettings {
    let Ok(store) = app.store(STORE) else {
        return AppSettings::default();
    };
    match store.get(KEY) {
        Some(v) => serde_json::from_value(v).unwrap_or_default(),
        None => AppSettings::default(),
    }
}

pub fn save(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let store = app.store(STORE).map_err(|e| e.to_string())?;
    let value = serde_json::to_value(settings).map_err(|e| e.to_string())?;
    store.set(KEY, value);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> AppSettings {
    load(&app)
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    settings: AppSettings,
    hide_flag: State<'_, Arc<AtomicBool>>,
    weather: State<'_, Arc<WeatherState>>,
) -> Result<AppSettings, String> {
    save(&app, &settings)?;
    hide_flag.store(settings.hide_on_fullscreen, Ordering::Relaxed);

    let autostart = app.autolaunch();
    if settings.autostart {
        let _ = autostart.enable();
    } else {
        let _ = autostart.disable();
    }

    if let Ok(mut g) = weather.reload.lock() {
        *g = true;
    }

    if let Some(win) = app.get_webview_window("main") {
        window::position_island(&win, &settings);
    }

    let _ = app.emit("settings:changed", settings.clone());
    Ok(settings)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub id: String,
    pub name: String,
    pub is_primary: bool,
    pub width: u32,
    pub height: u32,
}

#[tauri::command]
pub fn list_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let win = app
        .get_webview_window("main")
        .ok_or_else(|| "ana pencere yok".to_string())?;
    let monitors = win.available_monitors().map_err(|e| e.to_string())?;
    let primary = win.primary_monitor().map_err(|e| e.to_string())?;
    let primary_name = primary.as_ref().and_then(|m| m.name().map(|s| s.to_string()));

    Ok(monitors
        .into_iter()
        .enumerate()
        .map(|(i, m)| {
            let name = m
                .name()
                .map(|s| s.to_string())
                .unwrap_or_else(|| format!("Monitör {}", i + 1));
            let size = m.size();
            let is_primary = primary_name.as_ref() == Some(&name);
            MonitorInfo {
                id: name.clone(),
                name,
                is_primary,
                width: size.width,
                height: size.height,
            }
        })
        .collect())
}
