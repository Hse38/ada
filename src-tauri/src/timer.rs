use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TimerInfo {
    pub running: bool,
    pub mode: String,
    pub remaining_sec: u64,
    pub total_sec: u64,
}

struct Inner {
    running: bool,
    mode: String,
    remaining: u64,
    total: u64,
    deadline: Option<Instant>,
}

pub struct TimerState {
    inner: Mutex<Inner>,
}

impl TimerState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(Inner {
                running: false,
                mode: "pomodoro".into(),
                remaining: 25 * 60,
                total: 25 * 60,
                deadline: None,
            }),
        }
    }

    fn snapshot(inner: &Inner) -> TimerInfo {
        let remaining = if inner.running {
            inner
                .deadline
                .map(|d| d.saturating_duration_since(Instant::now()).as_secs())
                .unwrap_or(inner.remaining)
        } else {
            inner.remaining
        };
        TimerInfo {
            running: inner.running,
            mode: inner.mode.clone(),
            remaining_sec: remaining,
            total_sec: inner.total,
        }
    }
}

pub fn start_timer_ticker(app: AppHandle, state: Arc<TimerState>) {
    thread::spawn(move || {
        let mut last: Option<TimerInfo> = None;
        loop {
            let info = {
                let mut g = match state.inner.lock() {
                    Ok(g) => g,
                    Err(_) => {
                        thread::sleep(Duration::from_millis(500));
                        continue;
                    }
                };
                if g.running {
                    if let Some(deadline) = g.deadline {
                        if Instant::now() >= deadline {
                            g.running = false;
                            g.remaining = 0;
                            g.deadline = None;
                            let _ = app.emit("timer:done", g.mode.clone());
                        } else {
                            g.remaining = deadline
                                .saturating_duration_since(Instant::now())
                                .as_secs();
                        }
                    }
                }
                TimerState::snapshot(&g)
            };

            if last.as_ref() != Some(&info) {
                last = Some(info.clone());
                let _ = app.emit("timer:update", info);
            }
            thread::sleep(Duration::from_millis(500));
        }
    });
}

#[tauri::command]
pub fn timer_get(state: tauri::State<'_, Arc<TimerState>>) -> TimerInfo {
    state
        .inner
        .lock()
        .map(|g| TimerState::snapshot(&g))
        .unwrap_or(TimerInfo {
            running: false,
            mode: "pomodoro".into(),
            remaining_sec: 25 * 60,
            total_sec: 25 * 60,
        })
}

#[tauri::command]
pub fn timer_start(
    state: tauri::State<'_, Arc<TimerState>>,
    mode: String,
    seconds: u64,
) -> Result<TimerInfo, String> {
    let mut g = state.inner.lock().map_err(|_| "timer kilidi".to_string())?;
    let secs = if seconds == 0 { 25 * 60 } else { seconds };
    g.mode = mode;
    g.total = secs;
    g.remaining = secs;
    g.running = true;
    g.deadline = Some(Instant::now() + Duration::from_secs(secs));
    Ok(TimerState::snapshot(&g))
}

#[tauri::command]
pub fn timer_pause(state: tauri::State<'_, Arc<TimerState>>) -> Result<TimerInfo, String> {
    let mut g = state.inner.lock().map_err(|_| "timer kilidi".to_string())?;
    if g.running {
        if let Some(deadline) = g.deadline.take() {
            g.remaining = deadline.saturating_duration_since(Instant::now()).as_secs();
        }
        g.running = false;
    }
    Ok(TimerState::snapshot(&g))
}

#[tauri::command]
pub fn timer_resume(state: tauri::State<'_, Arc<TimerState>>) -> Result<TimerInfo, String> {
    let mut g = state.inner.lock().map_err(|_| "timer kilidi".to_string())?;
    if !g.running && g.remaining > 0 {
        g.running = true;
        g.deadline = Some(Instant::now() + Duration::from_secs(g.remaining));
    }
    Ok(TimerState::snapshot(&g))
}

#[tauri::command]
pub fn timer_reset(state: tauri::State<'_, Arc<TimerState>>) -> Result<TimerInfo, String> {
    let mut g = state.inner.lock().map_err(|_| "timer kilidi".to_string())?;
    g.running = false;
    g.deadline = None;
    g.remaining = g.total;
    Ok(TimerState::snapshot(&g))
}
