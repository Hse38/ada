use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use windows::Win32::Foundation::RECT;
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
use windows::Win32::UI::WindowsAndMessaging::{
    GetClassNameW, GetForegroundWindow, GetWindowRect, IsWindowVisible,
};

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BatteryInfo {
    pub percent: u32,
    pub charging: bool,
    pub present: bool,
}

pub fn read_battery() -> BatteryInfo {
    let mut status = SYSTEM_POWER_STATUS::default();
    if unsafe { GetSystemPowerStatus(&mut status) }.is_err() {
        return BatteryInfo {
            percent: 0,
            charging: false,
            present: false,
        };
    }

    let present = status.BatteryFlag != 128 && status.BatteryLifePercent != 255;
    let percent = if present {
        status.BatteryLifePercent.min(100) as u32
    } else {
        0
    };
    BatteryInfo {
        percent,
        charging: present && (status.BatteryFlag & 8) != 0,
        present,
    }
}

fn foreground_class() -> String {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return String::new();
        }
        let mut buf = [0u16; 256];
        let len = GetClassNameW(hwnd, &mut buf);
        if len == 0 {
            return String::new();
        }
        String::from_utf16_lossy(&buf[..len as usize])
    }
}

fn is_foreground_fullscreen() -> bool {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() || !IsWindowVisible(hwnd).as_bool() {
            return false;
        }

        let class = foreground_class();
        // Masaüstü / shell / tepsi asla tam ekran sayılmaz
        if matches!(
            class.as_str(),
            "Progman"
                | "WorkerW"
                | "Shell_TrayWnd"
                | "Shell_SecondaryTrayWnd"
                | "DV2ControlHost"
                | "ForegroundStaging"
                | "ApplicationFrameWindow" // UWP çerçeve (şüpheli)
        ) {
            return false;
        }

        let mut rect = RECT::default();
        if GetWindowRect(hwnd, &mut rect).is_err() {
            return false;
        }

        let w = rect.right - rect.left;
        let h = rect.bottom - rect.top;
        if w < 1000 || h < 700 {
            return false;
        }

        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if !GetMonitorInfoW(monitor, &mut info).as_bool() {
            return false;
        }

        let mon = info.rcMonitor;
        // Tam monitörü kaplayan (görev çubuğu dahil) — tipik F11 / oyun
        let covers = rect.left <= mon.left
            && rect.top <= mon.top
            && rect.right >= mon.right
            && rect.bottom >= mon.bottom;
        if !covers {
            return false;
        }

        // Maximize edilmiş normal pencereler görev çubuğunun üstünde kalır (rcWork).
        // rcMonitor'ü birebir kaplayanlar genelde exclusive fullscreen.
        true
    }
}

pub fn start_system_watchers(app: AppHandle, _hide_on_fullscreen: Arc<AtomicBool>) {
    thread::spawn(move || {
        let mut last_battery: Option<BatteryInfo> = None;
        let mut last_fs = false;

        if let Some(win) = app.get_webview_window("main") {
            let _ = win.show();
            let _ = win.set_always_on_top(true);
        }

        loop {
            let battery = read_battery();
            if last_battery.as_ref() != Some(&battery) {
                last_battery = Some(battery.clone());
                let _ = app.emit("system:battery", battery);
            }

            // Tam ekranda gizleme yok — slime modu presence ile halleder
            let fs = is_foreground_fullscreen();
            if fs != last_fs {
                last_fs = fs;
                let _ = app.emit("system:fullscreen", fs);
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_always_on_top(true);
                }
            }

            thread::sleep(Duration::from_millis(1500));
        }
    });
}

#[tauri::command]
pub fn get_battery() -> BatteryInfo {
    read_battery()
}
