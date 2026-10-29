use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use base64::{engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD}, Engine};
use chrono::{DateTime, Duration as ChronoDuration, Local, Utc};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};
use url::Url;

const KEYRING_SERVICE: &str = "com.ada.island";
const KEYRING_USER: &str = "google_refresh_token";
const SCOPE: &str = "https://www.googleapis.com/auth/calendar.readonly";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    pub start: String,
    pub end: String,
    pub all_day: bool,
    pub minutes_until: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarStatus {
    pub connected: bool,
    pub needs_reauth: bool,
    pub events: Vec<CalendarEvent>,
    pub upcoming: Option<CalendarEvent>,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: Option<i64>,
}

#[derive(Deserialize)]
struct EventsResponse {
    items: Option<Vec<ApiEvent>>,
}

#[derive(Deserialize)]
struct ApiEvent {
    id: Option<String>,
    summary: Option<String>,
    start: Option<ApiTime>,
    end: Option<ApiTime>,
}

#[derive(Deserialize)]
struct ApiTime {
    #[serde(rename = "dateTime")]
    date_time: Option<String>,
    date: Option<String>,
}

pub struct CalendarState {
    pub status: Mutex<CalendarStatus>,
    pub access_token: Mutex<Option<(String, DateTime<Utc>)>>,
    pub reload: Mutex<bool>,
}

impl CalendarState {
    pub fn new() -> Self {
        Self {
            status: Mutex::new(CalendarStatus {
                connected: read_refresh().is_some(),
                needs_reauth: false,
                events: vec![],
                upcoming: None,
            }),
            access_token: Mutex::new(None),
            reload: Mutex::new(true),
        }
    }
}

fn client_id() -> Option<String> {
    std::env::var("ADA_GOOGLE_CLIENT_ID")
        .ok()
        .filter(|s| !s.is_empty())
}

fn client_secret() -> Option<String> {
    std::env::var("ADA_GOOGLE_CLIENT_SECRET")
        .ok()
        .filter(|s| !s.is_empty())
}

fn read_refresh() -> Option<String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).ok()?;
    entry.get_password().ok()
}

fn write_refresh(token: &str) -> Result<(), String> {
    let entry =
        keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())?;
    entry.set_password(token).map_err(|e| e.to_string())
}

fn delete_refresh() {
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER) {
        let _ = entry.delete_credential();
    }
}

fn pkce_pair() -> (String, String) {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let verifier = URL_SAFE_NO_PAD.encode(bytes);
    let hash = Sha256::digest(verifier.as_bytes());
    let challenge = URL_SAFE_NO_PAD.encode(hash);
    (verifier, challenge)
}

fn exchange_code(code: &str, verifier: &str, redirect: &str) -> Result<TokenResponse, String> {
    let id = client_id().ok_or("ADA_GOOGLE_CLIENT_ID eksik")?;
    let secret = client_secret().ok_or("ADA_GOOGLE_CLIENT_SECRET eksik")?;
    let params = [
        ("code", code),
        ("client_id", id.as_str()),
        ("client_secret", secret.as_str()),
        ("redirect_uri", redirect),
        ("grant_type", "authorization_code"),
        ("code_verifier", verifier),
    ];
    reqwest::blocking::Client::new()
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .map_err(|e| e.to_string())
}

fn refresh_access(refresh: &str) -> Result<TokenResponse, String> {
    let id = client_id().ok_or("ADA_GOOGLE_CLIENT_ID eksik")?;
    let secret = client_secret().ok_or("ADA_GOOGLE_CLIENT_SECRET eksik")?;
    let params = [
        ("client_id", id.as_str()),
        ("client_secret", secret.as_str()),
        ("refresh_token", refresh),
        ("grant_type", "refresh_token"),
    ];
    reqwest::blocking::Client::new()
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .map_err(|e| e.to_string())
}

fn ensure_access(state: &CalendarState) -> Result<String, String> {
    if let Ok(guard) = state.access_token.lock() {
        if let Some((token, exp)) = guard.as_ref() {
            if *exp > Utc::now() + ChronoDuration::minutes(1) {
                return Ok(token.clone());
            }
        }
    }

    let refresh = read_refresh().ok_or("bağlı değil")?;
    let tokens = refresh_access(&refresh).map_err(|e| {
        delete_refresh();
        e
    })?;
    let exp = Utc::now() + ChronoDuration::seconds(tokens.expires_in.unwrap_or(3500));
    if let Ok(mut g) = state.access_token.lock() {
        *g = Some((tokens.access_token.clone(), exp));
    }
    Ok(tokens.access_token)
}

fn parse_event(ev: &ApiEvent, now: DateTime<Local>) -> Option<CalendarEvent> {
    let start_raw = ev.start.as_ref()?;
    let end_raw = ev.end.as_ref()?;
    let all_day = start_raw.date.is_some();
    let start = if let Some(dt) = &start_raw.date_time {
        DateTime::parse_from_rfc3339(dt).ok()?.with_timezone(&Local)
    } else if let Some(d) = &start_raw.date {
        chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d")
            .ok()?
            .and_hms_opt(0, 0, 0)?
            .and_local_timezone(Local)
            .single()?
    } else {
        return None;
    };
    let end = if let Some(dt) = &end_raw.date_time {
        DateTime::parse_from_rfc3339(dt).ok()?.with_timezone(&Local)
    } else if let Some(d) = &end_raw.date {
        chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d")
            .ok()?
            .and_hms_opt(23, 59, 59)?
            .and_local_timezone(Local)
            .single()?
    } else {
        return None;
    };

    let minutes_until = (start - now).num_minutes();
    Some(CalendarEvent {
        id: ev.id.clone().unwrap_or_else(|| STANDARD.encode(start.to_rfc3339())),
        title: ev
            .summary
            .clone()
            .unwrap_or_else(|| "Adsız etkinlik".into()),
        start: start.to_rfc3339(),
        end: end.to_rfc3339(),
        all_day,
        minutes_until,
    })
}

fn fetch_events(access: &str) -> Result<Vec<CalendarEvent>, String> {
    let now = Local::now();
    let time_min = now.to_rfc3339();
    let time_max = (now + ChronoDuration::days(2)).to_rfc3339();
    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin={}&timeMax={}&maxResults=20",
        urlencoding::encode(&time_min),
        urlencoding::encode(&time_max)
    );
    let resp: EventsResponse = reqwest::blocking::Client::new()
        .get(&url)
        .bearer_auth(access)
        .send()
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .map_err(|e| e.to_string())?;

    let mut events: Vec<CalendarEvent> = resp
        .items
        .unwrap_or_default()
        .iter()
        .filter_map(|e| parse_event(e, now))
        .collect();
    events.sort_by_key(|e| e.minutes_until);
    Ok(events)
}

fn build_status(events: Vec<CalendarEvent>, connected: bool, needs_reauth: bool) -> CalendarStatus {
    let upcoming = events
        .iter()
        .find(|e| e.minutes_until >= 0 && e.minutes_until <= 10)
        .cloned();
    CalendarStatus {
        connected,
        needs_reauth,
        events,
        upcoming,
    }
}

pub fn start_calendar_watcher(app: AppHandle, state: Arc<CalendarState>) {
    thread::spawn(move || {
        loop {
            let force = state
                .reload
                .lock()
                .map(|mut g| {
                    let v = *g;
                    *g = false;
                    v
                })
                .unwrap_or(false);

            if read_refresh().is_some() {
                match ensure_access(&state).and_then(|t| fetch_events(&t)) {
                    Ok(events) => {
                        let status = build_status(events, true, false);
                        if let Ok(mut g) = state.status.lock() {
                            *g = status.clone();
                        }
                        let _ = app.emit("calendar:update", status);
                    }
                    Err(e) => {
                        eprintln!("[ada] takvim: {e}");
                        let status = build_status(vec![], false, true);
                        if let Ok(mut g) = state.status.lock() {
                            *g = status.clone();
                        }
                        let _ = app.emit("calendar:update", status);
                    }
                }
            } else if force {
                let status = build_status(vec![], false, false);
                if let Ok(mut g) = state.status.lock() {
                    *g = status.clone();
                }
                let _ = app.emit("calendar:update", status);
            }

            for _ in 0..60 {
                thread::sleep(Duration::from_secs(5));
                if state.reload.lock().map(|g| *g).unwrap_or(false) {
                    break;
                }
            }
        }
    });
}

#[tauri::command]
pub fn calendar_status(state: tauri::State<'_, Arc<CalendarState>>) -> CalendarStatus {
    state
        .status
        .lock()
        .map(|g| g.clone())
        .unwrap_or_else(|_| build_status(vec![], false, false))
}

#[tauri::command]
pub fn calendar_events(state: tauri::State<'_, Arc<CalendarState>>) -> Vec<CalendarEvent> {
    state
        .status
        .lock()
        .map(|g| g.events.clone())
        .unwrap_or_default()
}

#[tauri::command]
pub fn calendar_disconnect(state: tauri::State<'_, Arc<CalendarState>>) -> Result<(), String> {
    delete_refresh();
    if let Ok(mut g) = state.access_token.lock() {
        *g = None;
    }
    if let Ok(mut g) = state.status.lock() {
        *g = build_status(vec![], false, false);
    }
    if let Ok(mut g) = state.reload.lock() {
        *g = true;
    }
    Ok(())
}

#[tauri::command]
pub fn calendar_connect(
    app: AppHandle,
    state: tauri::State<'_, Arc<CalendarState>>,
) -> Result<CalendarStatus, String> {
    let id = client_id().ok_or_else(|| {
        "Google OAuth ayarlı değil. .env içine ADA_GOOGLE_CLIENT_ID ve ADA_GOOGLE_CLIENT_SECRET ekle."
            .to_string()
    })?;
    let _ = client_secret().ok_or("ADA_GOOGLE_CLIENT_SECRET eksik")?;

    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect = format!("http://127.0.0.1:{port}");
    let (verifier, challenge) = pkce_pair();

    let mut auth = Url::parse("https://accounts.google.com/o/oauth2/v2/auth")
        .map_err(|e| e.to_string())?;
    {
        let mut q = auth.query_pairs_mut();
        q.append_pair("client_id", &id);
        q.append_pair("redirect_uri", &redirect);
        q.append_pair("response_type", "code");
        q.append_pair("scope", SCOPE);
        q.append_pair("access_type", "offline");
        q.append_pair("prompt", "consent");
        q.append_pair("code_challenge", &challenge);
        q.append_pair("code_challenge_method", "S256");
    }

    open::that(auth.as_str()).map_err(|e| format!("tarayıcı açılamadı: {e}"))?;

    listener
        .set_nonblocking(false)
        .map_err(|e| e.to_string())?;
    let (mut stream, _) = listener.accept().map_err(|e| e.to_string())?;
    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).map_err(|e| e.to_string())?;
    let req = String::from_utf8_lossy(&buf[..n]);
    let first = req.lines().next().unwrap_or("");
    let path = first.split_whitespace().nth(1).unwrap_or("/");
    let full = format!("http://127.0.0.1{path}");
    let parsed = Url::parse(&full).map_err(|e| e.to_string())?;
    let code = parsed
        .query_pairs()
        .find(|(k, _)| k == "code")
        .map(|(_, v)| v.to_string())
        .ok_or_else(|| "OAuth kodu alınamadı".to_string())?;

    let body = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n<!doctype html><html><body style='font-family:Segoe UI;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh'>Ada baglandi. Bu pencereyi kapatabilirsin.</body></html>";
    let _ = stream.write_all(body.as_bytes());

    let tokens = exchange_code(&code, &verifier, &redirect)?;
    let refresh = tokens
        .refresh_token
        .ok_or_else(|| "refresh token gelmedi; Google Console'da Testing + consent kontrol et".to_string())?;
    write_refresh(&refresh)?;

    let exp = Utc::now() + ChronoDuration::seconds(tokens.expires_in.unwrap_or(3500));
    if let Ok(mut g) = state.access_token.lock() {
        *g = Some((tokens.access_token.clone(), exp));
    }

    let events = fetch_events(&tokens.access_token).unwrap_or_default();
    let status = build_status(events, true, false);
    if let Ok(mut g) = state.status.lock() {
        *g = status.clone();
    }
    let _ = app.emit("calendar:update", status.clone());
    Ok(status)
}
