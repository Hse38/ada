use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

use crate::window;

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let settings = MenuItem::with_id(app, "settings", "Ayarlar", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&settings, &quit])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().ok_or("tray ikonu yok")?)
        .menu(&menu)
        .tooltip("Ada")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => app.exit(0),
            "settings" => {
                if let Err(e) = window::open_settings_window(app) {
                    eprintln!("[ada] ayarlar: {e}");
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_always_on_top(true);
                }
            }
        })
        .build(app)?;

    Ok(())
}
