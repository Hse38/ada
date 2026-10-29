import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface MediaInfo {
  title: string;
  artist: string;
  album: string;
  thumbnailBase64: string | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  sourceApp: string;
}

export interface WeatherInfo {
  temperature: number;
  weatherCode: number;
  high: number;
  low: number;
  label: string;
  icon: string;
}

export interface BatteryInfo {
  percent: number;
  charging: boolean;
  present: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  minutesUntil: number;
}

export interface CalendarStatus {
  connected: boolean;
  needsReauth: boolean;
  events: CalendarEvent[];
  upcoming: CalendarEvent | null;
}

export interface ClipboardItem {
  id: string;
  text: string;
  preview: string;
}

export interface TimerInfo {
  running: boolean;
  mode: string;
  remainingSec: number;
  totalSec: number;
}

export interface HudEvent {
  kind: string;
  value: number;
  muted: boolean;
}

export interface DroppedFile {
  name: string;
  path: string;
  size: number;
}

export interface AppSettings {
  monitorId: string | null;
  autostart: boolean;
  hideOnFullscreen: boolean;
  showMedia: boolean;
  showWeather: boolean;
  showCalendar: boolean;
  showBattery: boolean;
  showClipboard: boolean;
  showTimer: boolean;
  weatherLat: number;
  weatherLon: number;
  weatherLabel: string;
  weatherTimezone: string;
}

export interface MonitorInfo {
  id: string;
  name: string;
  isPrimary: boolean;
  width: number;
  height: number;
}

export const setIslandBounds = (width: number, height: number) =>
  invoke("set_island_bounds", { width, height });

export const mediaPlayPause = () => invoke("media_play_pause");
export const mediaNext = () => invoke("media_next");
export const mediaPrevious = () => invoke("media_previous");
export const mediaGet = () => invoke<MediaInfo | null>("media_get");

export const getSettings = () => invoke<AppSettings>("get_settings");
export const saveSettings = (settings: AppSettings) =>
  invoke<AppSettings>("save_settings", { settings });
export const listMonitors = () => invoke<MonitorInfo[]>("list_monitors");
export const openSettings = () => invoke("open_settings");
export const repositionIsland = () => invoke("reposition_island");

export const getBattery = () => invoke<BatteryInfo>("get_battery");
export const weatherGet = () => invoke<WeatherInfo | null>("weather_get");
export const weatherRefresh = () => invoke("weather_refresh");

export const calendarConnect = () => invoke<CalendarStatus>("calendar_connect");
export const calendarDisconnect = () => invoke("calendar_disconnect");
export const calendarStatus = () => invoke<CalendarStatus>("calendar_status");
export const calendarEvents = () => invoke<CalendarEvent[]>("calendar_events");

export const clipboardHistory = () => invoke<ClipboardItem[]>("clipboard_history");
export const clipboardClear = () => invoke("clipboard_clear");
export const clipboardCopy = (text: string) => invoke("clipboard_copy", { text });

export const timerGet = () => invoke<TimerInfo>("timer_get");
export const timerStart = (mode: string, seconds: number) =>
  invoke<TimerInfo>("timer_start", { mode, seconds });
export const timerPause = () => invoke<TimerInfo>("timer_pause");
export const timerResume = () => invoke<TimerInfo>("timer_resume");
export const timerReset = () => invoke<TimerInfo>("timer_reset");

export const filesList = () => invoke<DroppedFile[]>("files_list");
export const filesImport = (paths: string[]) =>
  invoke<DroppedFile[]>("files_import", { paths });
export const filesClear = () => invoke("files_clear");
export const filesOpenFolder = () => invoke("files_open_folder");
export const filesReveal = (path: string) => invoke("files_reveal", { path });
export const filesOpen = (path: string) => invoke("files_open", { path });
export const filesRemove = (path: string) =>
  invoke<DroppedFile[]>("files_remove", { path });

export interface PresenceInfo {
  slime: boolean;
  reason: string;
}

export const onIslandHover = (cb: () => void) => listen("island:hover", () => cb());
export const onIslandLeave = (cb: () => void) => listen("island:leave", () => cb());
export const onIslandPresence = (cb: (p: PresenceInfo) => void) =>
  listen<PresenceInfo>("island:presence", (e) => cb(e.payload));
export const onMediaUpdate = (cb: (info: MediaInfo | null) => void) =>
  listen<MediaInfo | null>("media:update", (e) => cb(e.payload));
export const onWeatherUpdate = (cb: (info: WeatherInfo) => void) =>
  listen<WeatherInfo>("weather:update", (e) => cb(e.payload));
export const onBatteryUpdate = (cb: (info: BatteryInfo) => void) =>
  listen<BatteryInfo>("system:battery", (e) => cb(e.payload));
export const onCalendarUpdate = (cb: (info: CalendarStatus) => void) =>
  listen<CalendarStatus>("calendar:update", (e) => cb(e.payload));
export const onClipboardUpdate = (cb: (items: ClipboardItem[]) => void) =>
  listen<ClipboardItem[]>("clipboard:update", (e) => cb(e.payload));
export const onTimerUpdate = (cb: (info: TimerInfo) => void) =>
  listen<TimerInfo>("timer:update", (e) => cb(e.payload));
export const onTimerDone = (cb: (mode: string) => void) =>
  listen<string>("timer:done", (e) => cb(e.payload));
export const onHudShow = (cb: (ev: HudEvent) => void) =>
  listen<HudEvent>("hud:show", (e) => cb(e.payload));
export const onFilesUpdate = (cb: (files: DroppedFile[]) => void) =>
  listen<DroppedFile[]>("files:update", (e) => cb(e.payload));
export const onSettingsChanged = (cb: (s: AppSettings) => void) =>
  listen<AppSettings>("settings:changed", (e) => cb(e.payload));

export function thumbnailSrc(base64: string | null | undefined): string | null {
  if (!base64) return null;
  return `data:image/jpeg;base64,${base64}`;
}

export function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export type Unlisten = UnlistenFn;
