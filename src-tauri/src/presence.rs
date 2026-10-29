use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use windows::core::BOOL;
use windows::Win32::Foundation::{HWND, LPARAM, RECT, FALSE, TRUE};
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromRect, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetClassNameW, GetForegroundWindow, GetWindowLongW, GetWindowRect,
    GetWindowTextLengthW, IsIconic, IsWindowVisible, GWL_EXSTYLE, WINDOW_EX_STYLE,
    WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT,
};

use crate::settings;

const STRIP_H: i32 = 56;
const CENTER_BAND: i32 = 420;

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PresenceInfo {
    pub slime: bool,
    pub reason: String,
}

struct EnumCtx {
    ada: isize,
    strip: RECT,
    band_left: i32,
    band_right: i32,
    hit: bool,
}

unsafe extern "system" fn enum_cb(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let ctx = &mut *(lparam.0 as *mut EnumCtx);
    if hwnd.0 as isize == ctx.ada {
        return TRUE;
    }
    if !IsWindowVisible(hwnd).as_bool() || IsIconic(hwnd).as_bool() {
        return TRUE;
    }

    let mut class = [0u16; 128];
    let n = GetClassNameW(hwnd, &mut class);
    let class = String::from_utf16_lossy(&class[..n as usize]);
    if matches!(
        class.as_str(),
        "Progman"
            | "WorkerW"
            | "Shell_TrayWnd"
            | "Shell_SecondaryTrayWnd"
            | "DV2ControlHost"
            | "ForegroundStaging"
            | "Windows.UI.Core.CoreWindow"
            | "PseudoConsoleWindow"
    ) {
        return TRUE;
    }

    let ex = WINDOW_EX_STYLE(GetWindowLongW(hwnd, GWL_EXSTYLE) as u32);
    if ex.contains(WS_EX_TOOLWINDOW) || ex.contains(WS_EX_NOACTIVATE) || ex.contains(WS_EX_TRANSPARENT)
    {
        return TRUE;
    }

    if GetWindowTextLengthW(hwnd) == 0 {
        let mut r = RECT::default();
        if GetWindowRect(hwnd, &mut r).is_ok() {
            let w = r.right - r.left;
            let h = r.bottom - r.top;
            if w < 200 || h < 40 {
                return TRUE;
            }
        }
    }

    let mut r = RECT::default();
    if GetWindowRect(hwnd, &mut r).is_err() {
        return TRUE;
    }

    let overlaps_y = r.top < ctx.strip.bottom && r.bottom > ctx.strip.top;
    let overlaps_x = r.left < ctx.band_right && r.right > ctx.band_left;
    if overlaps_y && overlaps_x && r.top <= ctx.strip.top + 8 {
        ctx.hit = true;
        return FALSE;
    }
    TRUE
}

fn is_fullscreen_now() -> bool {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_invalid() || !IsWindowVisible(hwnd).as_bool() {
            return false;
        }
        let mut class = [0u16; 128];
        let n = GetClassNameW(hwnd, &mut class);
        let class = String::from_utf16_lossy(&class[..n as usize]);
        if matches!(
            class.as_str(),
            "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd"
        ) {
            return false;
        }
        let mut rect = RECT::default();
        if GetWindowRect(hwnd, &mut rect).is_err() {
            return false;
        }
        if (rect.right - rect.left) < 1000 || (rect.bottom - rect.top) < 700 {
            return false;
        }
        let monitor = MonitorFromRect(&rect, MONITOR_DEFAULTTONEAREST);
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if !GetMonitorInfoW(monitor, &mut info).as_bool() {
            return false;
        }
        let mon = info.rcMonitor;
        rect.left <= mon.left
            && rect.top <= mon.top
            && rect.right >= mon.right
            && rect.bottom >= mon.bottom
    }
}

fn top_occupied(ada_hwnd: isize) -> bool {
    unsafe {
        let hwnd = HWND(ada_hwnd as _);
        let mut app_win_rect = RECT::default();
        if GetWindowRect(hwnd, &mut app_win_rect).is_err() {
            return false;
        }

        let monitor = MonitorFromRect(&app_win_rect, MONITOR_DEFAULTTONEAREST);
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if !GetMonitorInfoW(monitor, &mut info).as_bool() {
            return false;
        }
        let mon = info.rcMonitor;
        let mid = (mon.left + mon.right) / 2;
        let strip = RECT {
            left: mon.left,
            top: mon.top,
            right: mon.right,
            bottom: mon.top + STRIP_H,
        };
        let mut ctx = EnumCtx {
            ada: ada_hwnd,
            strip,
            band_left: mid - CENTER_BAND / 2,
            band_right: mid + CENTER_BAND / 2,
            hit: false,
        };
        let _ = EnumWindows(Some(enum_cb), LPARAM(&mut ctx as *mut _ as isize));
        ctx.hit
    }
}

pub fn start_presence_watcher(app: AppHandle, hovering: Arc<AtomicBool>) {
    thread::spawn(move || {
        let mut last = PresenceInfo {
            slime: false,
            reason: "init".into(),
        };
        thread::sleep(Duration::from_millis(800));

        loop {
            if hovering.load(Ordering::Relaxed) {
                thread::sleep(Duration::from_millis(400));
                continue;
            }

            let _ = settings::load(&app);
            let ada_hwnd = app
                .get_webview_window("main")
                .and_then(|w| w.hwnd().ok())
                .map(|h| h.0 as isize);

            let (slime, reason) = if is_fullscreen_now() {
                (true, "fullscreen")
            } else if let Some(hwnd) = ada_hwnd {
                if top_occupied(hwnd) {
                    (true, "overlap")
                } else {
                    (false, "clear")
                }
            } else {
                (false, "no-window")
            };

            let next = PresenceInfo {
                slime,
                reason: reason.into(),
            };
            if next != last {
                last = next.clone();
                let _ = app.emit("island:presence", next);
            }

            thread::sleep(Duration::from_millis(450));
        }
    });
}
