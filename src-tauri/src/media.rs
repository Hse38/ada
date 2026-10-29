use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession,
    GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus,
};
use windows::Storage::Streams::DataReader;
use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub thumbnail_base64: Option<String>,
    pub is_playing: bool,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub source_app: String,
}

struct MediaInner {
    manager: Option<GlobalSystemMediaTransportControlsSessionManager>,
    last_fingerprint: String,
}

pub struct MediaState {
    inner: Mutex<MediaInner>,
}

impl MediaState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(MediaInner {
                manager: None,
                last_fingerprint: String::new(),
            }),
        }
    }
}

fn init_com() {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
}

fn request_manager() -> Option<GlobalSystemMediaTransportControlsSessionManager> {
    match GlobalSystemMediaTransportControlsSessionManager::RequestAsync() {
        Ok(op) => match op.get() {
            Ok(m) => Some(m),
            Err(e) => {
                eprintln!("[ada] media manager get: {e}");
                None
            }
        },
        Err(e) => {
            eprintln!("[ada] media manager request: {e}");
            None
        }
    }
}

fn read_thumbnail_base64(
    session: &GlobalSystemMediaTransportControlsSession,
) -> Option<String> {
    let props = session.TryGetMediaPropertiesAsync().ok()?.get().ok()?;
    let thumb = props.Thumbnail().ok()?;
    let stream = thumb.OpenReadAsync().ok()?.get().ok()?;
    let size = stream.Size().ok()? as u32;
    if size == 0 || size > 2_000_000 {
        return None;
    }
    let reader = DataReader::CreateDataReader(&stream).ok()?;
    reader.LoadAsync(size).ok()?.get().ok()?;
    let mut buf = vec![0u8; size as usize];
    reader.ReadBytes(&mut buf).ok()?;
    Some(STANDARD.encode(buf))
}

fn session_to_info(session: &GlobalSystemMediaTransportControlsSession) -> Option<MediaInfo> {
    let props = session.TryGetMediaPropertiesAsync().ok()?.get().ok()?;
    let title = props.Title().unwrap_or_default().to_string();
    let artist = props.Artist().unwrap_or_default().to_string();
    let album = props.AlbumTitle().unwrap_or_default().to_string();

    if title.is_empty() && artist.is_empty() {
        return None;
    }

    let playback = session.GetPlaybackInfo().ok()?;
    let status = playback.PlaybackStatus().unwrap_or(
        GlobalSystemMediaTransportControlsSessionPlaybackStatus::Closed,
    );
    let is_playing =
        status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;

    let timeline = session.GetTimelineProperties().ok()?;
    let position = timeline.Position().unwrap_or_default();
    let end = timeline.EndTime().unwrap_or_default();
    let position_ms = (position.Duration / 10_000).max(0) as u64;
    let duration_ms = (end.Duration / 10_000).max(0) as u64;

    let source_app = session
        .SourceAppUserModelId()
        .map(|s| s.to_string())
        .unwrap_or_default();

    // Thumbnail pahalı; sadece şarkı değişince al (caller kontrol eder)
    Some(MediaInfo {
        title,
        artist,
        album,
        thumbnail_base64: None,
        is_playing,
        position_ms,
        duration_ms,
        source_app,
    })
}

fn enrich_thumbnail(
    session: &GlobalSystemMediaTransportControlsSession,
    info: &mut MediaInfo,
) {
    if info.thumbnail_base64.is_none() {
        info.thumbnail_base64 = read_thumbnail_base64(session);
    }
}

fn fingerprint(info: &MediaInfo) -> String {
    format!(
        "{}|{}|{}|{}|{}|{}",
        info.title,
        info.artist,
        info.is_playing,
        info.position_ms / 1000,
        info.duration_ms,
        info.thumbnail_base64.as_ref().map(|s| s.len()).unwrap_or(0)
    )
}

fn current_session(
    manager: &GlobalSystemMediaTransportControlsSessionManager,
) -> Option<GlobalSystemMediaTransportControlsSession> {
    manager.GetCurrentSession().ok()
}

fn emit_media(app: &AppHandle, info: Option<MediaInfo>) {
    if let Err(e) = app.emit("media:update", info) {
        eprintln!("[ada] media:update emit: {e}");
    }
}

pub fn start_media_watcher(app: AppHandle, state: Arc<MediaState>) {
    thread::spawn(move || {
        init_com();

        {
            let mut inner = match state.inner.lock() {
                Ok(g) => g,
                Err(_) => return,
            };
            inner.manager = request_manager();
        }

        loop {
            thread::sleep(Duration::from_millis(800));

            let snapshot = {
                let mut inner = match state.inner.lock() {
                    Ok(g) => g,
                    Err(_) => continue,
                };

                if inner.manager.is_none() {
                    inner.manager = request_manager();
                }

                let session = inner.manager.as_ref().and_then(current_session);
                let mut info = session.as_ref().and_then(|s| session_to_info(s));

                let fp = match &info {
                    Some(i) => format!(
                        "{}|{}|{}|{}",
                        i.title, i.artist, i.is_playing, i.duration_ms
                    ),
                    None => String::new(),
                };

                if fp == inner.last_fingerprint {
                    None
                } else {
                    if let (Some(ref mut i), Some(ref s)) = (&mut info, &session) {
                        enrich_thumbnail(s, i);
                    }
                    inner.last_fingerprint = fp;
                    Some(info)
                }
            };

            if let Some(info) = snapshot {
                emit_media(&app, info);
            }
        }
    });
}

fn with_session<F>(state: &MediaState, f: F) -> Result<(), String>
where
    F: FnOnce(&GlobalSystemMediaTransportControlsSession) -> windows::core::Result<()>,
{
    let inner = state
        .inner
        .lock()
        .map_err(|_| "media kilidi alınamadı".to_string())?;
    let manager = inner
        .manager
        .as_ref()
        .ok_or_else(|| "medya oturumu yok".to_string())?;
    let session = current_session(manager).ok_or_else(|| "aktif oturum yok".to_string())?;
    f(&session).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn media_play_pause(state: tauri::State<'_, Arc<MediaState>>) -> Result<(), String> {
    with_session(&state, |s| {
        let info = s.GetPlaybackInfo()?;
        let status = info.PlaybackStatus()?;
        if status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing {
            let _ = s.TryPauseAsync()?.get()?;
        } else {
            let _ = s.TryPlayAsync()?.get()?;
        }
        Ok(())
    })
}

#[tauri::command]
pub fn media_next(state: tauri::State<'_, Arc<MediaState>>) -> Result<(), String> {
    with_session(&state, |s| {
        let _ = s.TrySkipNextAsync()?.get()?;
        Ok(())
    })
}

#[tauri::command]
pub fn media_previous(state: tauri::State<'_, Arc<MediaState>>) -> Result<(), String> {
    with_session(&state, |s| {
        let _ = s.TrySkipPreviousAsync()?.get()?;
        Ok(())
    })
}

#[tauri::command]
pub fn media_get(state: tauri::State<'_, Arc<MediaState>>) -> Result<Option<MediaInfo>, String> {
    let inner = state
        .inner
        .lock()
        .map_err(|_| "media kilidi alınamadı".to_string())?;
    let info = inner
        .manager
        .as_ref()
        .and_then(current_session)
        .and_then(|s| session_to_info(&s));
    Ok(info)
}
