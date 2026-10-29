use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardItem {
    pub id: String,
    pub text: String,
    pub preview: String,
}

pub struct ClipboardState {
    pub items: Mutex<Vec<ClipboardItem>>,
}

impl ClipboardState {
    pub fn new() -> Self {
        Self {
            items: Mutex::new(Vec::new()),
        }
    }
}

fn read_clipboard_text() -> Option<String> {
    let mut cb = arboard::Clipboard::new().ok()?;
    let text = cb.get_text().ok()?;
    let trimmed = text.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn preview(text: &str) -> String {
    let flat = text.replace('\n', " ").replace('\r', "");
    if flat.chars().count() > 60 {
        format!("{}…", flat.chars().take(60).collect::<String>())
    } else {
        flat
    }
}

pub fn start_clipboard_watcher(app: AppHandle, state: Arc<ClipboardState>) {
    thread::spawn(move || {
        let mut last = String::new();
        loop {
            if let Some(text) = read_clipboard_text() {
                if text != last {
                    last = text.clone();
                    let item = ClipboardItem {
                        id: format!("{}", chrono::Utc::now().timestamp_millis()),
                        preview: preview(&text),
                        text,
                    };
                    if let Ok(mut items) = state.items.lock() {
                        items.retain(|i| i.text != item.text);
                        items.insert(0, item);
                        items.truncate(10);
                        let _ = app.emit("clipboard:update", items.clone());
                    }
                }
            }
            thread::sleep(Duration::from_millis(1500));
        }
    });
}

#[tauri::command]
pub fn clipboard_history(state: tauri::State<'_, Arc<ClipboardState>>) -> Vec<ClipboardItem> {
    state.items.lock().map(|g| g.clone()).unwrap_or_default()
}

#[tauri::command]
pub fn clipboard_clear(state: tauri::State<'_, Arc<ClipboardState>>) -> Result<(), String> {
    if let Ok(mut g) = state.items.lock() {
        g.clear();
    }
    Ok(())
}

#[tauri::command]
pub fn clipboard_copy(text: String) -> Result<(), String> {
    let mut cb = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    cb.set_text(text).map_err(|e| e.to_string())
}
