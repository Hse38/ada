use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

use crate::settings::{self, AppSettings};

pub const WINDOW_WIDTH: f64 = 740.0;
pub const WINDOW_HEIGHT: f64 = 340.0;
const TOP_OFFSET: i32 = 8;
const POLL_MS: u64 = 32;
const LEAVE_DELAY_MS: u64 = 280;
const HIT_PAD: i32 = 8;

#[derive(Clone, Copy, Debug)]
pub struct IslandBounds {
    pub width: f64,
    pub height: f64,
}

impl Default for IslandBounds {
    fn default() -> Self {
        Self {
            width: 280.0,
            height: 40.0,
        }
    }
}

pub struct WindowState {
    pub bounds: Mutex<IslandBounds>,
}

impl WindowState {
    pub fn new() -> Self {
        Self {
            bounds: Mutex::new(IslandBounds::default()),
        }
    }
}

pub fn position_island(window: &WebviewWindow, settings: &AppSettings) {
    let monitors = match window.available_monitors() {
        Ok(m) => m,
        Err(e) => {
            eprintln!("[ada] monitör listesi: {e}");
            return;
        }
    };

    let monitor = if let Some(id) = &settings.monitor_id {
        monitors
            .iter()
            .find(|m| m.name().map(|n| n == id.as_str()).unwrap_or(false))
            .cloned()
            .or_else(|| window.primary_monitor().ok().flatten())
    } else {
        window.primary_monitor().ok().flatten()
    };

    let Some(monitor) = monitor else {
        eprintln!("[ada] monitör bulunamadı");
        return;
    };

    let scale = monitor.scale_factor();
    let mon_pos = monitor.position();
    let mon_size = monitor.size();
    let win_w = (WINDOW_WIDTH * scale).round() as i32;
    let top = (TOP_OFFSET as f64 * scale).round() as i32;
    let x = mon_pos.x + (mon_size.width as i32 - win_w) / 2;
    let y = mon_pos.y + top;

    if let Err(e) = window.set_position(PhysicalPosition::new(x, y)) {
        eprintln!("[ada] pencere konumlanamadı: {e}");
    }
}

/// Sadece hit-test boyutunu güncelle — native pencereyi YENİDEN BOYUTLANDIRMA.
#[tauri::command]
pub fn set_island_bounds(
    state: tauri::State<'_, Arc<WindowState>>,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let mut bounds = state
        .bounds
        .lock()
        .map_err(|_| "bounds kilidi alınamadı".to_string())?;
    bounds.width = width.clamp(20.0, WINDOW_WIDTH);
    bounds.height = height.clamp(6.0, WINDOW_HEIGHT);
    Ok(())
}

pub fn start_hit_test(
    app: AppHandle,
    state: Arc<WindowState>,
    hovering_flag: Arc<AtomicBool>,
) {
    thread::spawn(move || {
        let mut hovering = false;
        let mut leave_at: Option<Instant> = None;

        loop {
            thread::sleep(Duration::from_millis(POLL_MS));

            let Some(window) = app.get_webview_window("main") else {
                continue;
            };

            let Ok(outer_pos) = window.outer_position() else {
                continue;
            };
            let Ok(outer_size) = window.outer_size() else {
                continue;
            };
            let Ok(scale) = window.scale_factor() else {
                continue;
            };

            let bounds = match state.bounds.lock() {
                Ok(b) => *b,
                Err(_) => continue,
            };

            let mut point = windows::Win32::Foundation::POINT::default();
            if unsafe {
                windows::Win32::UI::WindowsAndMessaging::GetCursorPos(&mut point)
            }
            .is_err()
            {
                continue;
            }

            let island_w = (bounds.width * scale).round() as i32;
            let island_h = (bounds.height * scale).round() as i32;
            let win_w = outer_size.width as i32;

            let island_x = outer_pos.x + (win_w - island_w) / 2;
            let island_y = outer_pos.y;
            // Slime çok ince — dikey pad biraz daha cömert
            let pad_y = if bounds.height < 16.0 { 14 } else { HIT_PAD };

            let inside = point.x >= island_x - HIT_PAD
                && point.x < island_x + island_w + HIT_PAD
                && point.y >= island_y - pad_y
                && point.y < island_y + island_h + pad_y;

            if inside {
                leave_at = None;
                if !hovering {
                    hovering = true;
                    hovering_flag.store(true, Ordering::Relaxed);
                    let win = window.clone();
                    let win2 = window.clone();
                    let app2 = app.clone();
                    let _ = win.run_on_main_thread(move || {
                        let _ = win2.set_ignore_cursor_events(false);
                        let _ = win2.set_focus();
                        let _ = app2.emit("island:hover", ());
                    });
                }
            } else if hovering {
                let due = leave_at.get_or_insert_with(|| {
                    Instant::now() + Duration::from_millis(LEAVE_DELAY_MS)
                });
                if Instant::now() >= *due {
                    hovering = false;
                    hovering_flag.store(false, Ordering::Relaxed);
                    leave_at = None;
                    let win = window.clone();
                    let win2 = window.clone();
                    let app2 = app.clone();
                    let _ = win.run_on_main_thread(move || {
                        let _ = win2.set_ignore_cursor_events(true);
                        let _ = app2.emit("island:leave", ());
                    });
                }
            }
        }
    });
}

#[tauri::command]
pub fn reposition_island(app: AppHandle) -> Result<(), String> {
    let settings = settings::load(&app);
    let win = app
        .get_webview_window("main")
        .ok_or_else(|| "ana pencere yok".to_string())?;
    position_island(&win, &settings);
    Ok(())
}

pub fn open_settings_window(app: &AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }

    let url = if cfg!(debug_assertions) {
        WebviewUrl::External("http://localhost:1420/?window=settings".parse().unwrap())
    } else {
        WebviewUrl::App("index.html?window=settings".into())
    };

    WebviewWindowBuilder::new(app, "settings", url)
        .title("Ada Ayarları")
        .inner_size(480.0, 640.0)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_settings(app: AppHandle) -> Result<(), String> {
    open_settings_window(&app)
}
