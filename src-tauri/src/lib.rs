mod calendar;
mod clipboard;
mod files;
mod hud;
mod media;
mod presence;
mod settings;
mod system;
mod timer;
mod tray;
mod weather;
mod window;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use calendar::CalendarState;
use clipboard::ClipboardState;
use hud::HudState;
use media::MediaState;
use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;
use timer::TimerState;
use weather::WeatherState;
use window::WindowState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Önce CWD, yoksa exe yanındaki .env (release çift tık)
    let _ = dotenvy::dotenv();
    if std::env::var("ADA_GOOGLE_CLIENT_ID").is_err() {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                let _ = dotenvy::from_path(dir.join(".env"));
            }
        }
    }

    let window_state = Arc::new(WindowState::new());
    let media_state = Arc::new(MediaState::new());
    let weather_state = Arc::new(WeatherState::new());
    let calendar_state = Arc::new(CalendarState::new());
    let clipboard_state = Arc::new(ClipboardState::new());
    let timer_state = Arc::new(TimerState::new());
    let hud_state = Arc::new(HudState::new());
    let hide_on_fullscreen = Arc::new(AtomicBool::new(false));
    let hovering = Arc::new(AtomicBool::new(false));

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .manage(window_state.clone())
        .manage(media_state.clone())
        .manage(weather_state.clone())
        .manage(calendar_state.clone())
        .manage(clipboard_state.clone())
        .manage(timer_state.clone())
        .manage(hud_state.clone())
        .manage(hide_on_fullscreen.clone())
        .invoke_handler(tauri::generate_handler![
            window::set_island_bounds,
            window::reposition_island,
            window::open_settings,
            media::media_play_pause,
            media::media_next,
            media::media_previous,
            media::media_get,
            settings::get_settings,
            settings::save_settings,
            settings::list_monitors,
            system::get_battery,
            weather::weather_get,
            weather::weather_refresh,
            calendar::calendar_connect,
            calendar::calendar_disconnect,
            calendar::calendar_events,
            calendar::calendar_status,
            clipboard::clipboard_history,
            clipboard::clipboard_clear,
            clipboard::clipboard_copy,
            timer::timer_get,
            timer::timer_start,
            timer::timer_pause,
            timer::timer_resume,
            timer::timer_reset,
            files::files_list,
            files::files_import,
            files::files_clear,
            files::files_open_folder,
            files::files_reveal,
            files::files_open,
            files::files_remove,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            let cfg = settings::load(&handle);
            hide_on_fullscreen.store(cfg.hide_on_fullscreen, Ordering::Relaxed);

            hide_on_fullscreen.store(false, Ordering::Relaxed);

            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_size(tauri::LogicalSize::new(
                    window::WINDOW_WIDTH,
                    window::WINDOW_HEIGHT,
                ));
                window::position_island(&win, &cfg);
                let _ = win.set_ignore_cursor_events(true);
                let _ = win.show();
                let _ = win.set_always_on_top(true);
            }

            if let Err(e) = tray::setup_tray(&handle) {
                eprintln!("[ada] tray kurulamadı: {e}");
            }

            {
                use tauri_plugin_autostart::ManagerExt;
                let autostart = app.autolaunch();
                // Varsayılan açık; ayarlardan kapatılabilir
                if cfg.autostart {
                    let _ = autostart.enable();
                } else {
                    let _ = autostart.disable();
                }
            }

            window::start_hit_test(handle.clone(), window_state.clone(), hovering.clone());
            presence::start_presence_watcher(handle.clone(), hovering.clone());
            media::start_media_watcher(handle.clone(), media_state.clone());
            weather::start_weather_watcher(handle.clone(), weather_state.clone());
            calendar::start_calendar_watcher(handle.clone(), calendar_state.clone());
            clipboard::start_clipboard_watcher(handle.clone(), clipboard_state.clone());
            timer::start_timer_ticker(handle.clone(), timer_state.clone());
            hud::start_hud_watcher(handle.clone(), hud_state.clone());
            system::start_system_watchers(handle, hide_on_fullscreen.clone());

            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| eprintln!("[ada] uygulama hatası: {e}"));
}
