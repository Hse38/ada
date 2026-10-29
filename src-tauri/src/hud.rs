use std::sync::Arc;
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::AppHandle;

/// Ses/parlaklık HUD — şimdilik kapalı (WMI/COM ana thread'i kilitleyebiliyor).
#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HudEvent {
    pub kind: String,
    pub value: f32,
    pub muted: bool,
}

pub struct HudState;

impl HudState {
    pub fn new() -> Self {
        Self
    }
}

pub fn start_hud_watcher(_app: AppHandle, _state: Arc<HudState>) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(3600));
    });
}
