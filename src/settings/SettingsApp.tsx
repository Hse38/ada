import { useEffect, useState } from "react";
import {
  calendarConnect,
  calendarDisconnect,
  calendarStatus,
  getSettings,
  listMonitors,
  saveSettings,
  type AppSettings,
  type CalendarStatus,
  type MonitorInfo,
} from "../lib/tauri";

const CITIES: { label: string; lat: number; lon: number; tz: string }[] = [
  { label: "İstanbul", lat: 41.01, lon: 28.97, tz: "Europe/Istanbul" },
  { label: "Ankara", lat: 39.93, lon: 32.86, tz: "Europe/Istanbul" },
  { label: "İzmir", lat: 38.42, lon: 27.14, tz: "Europe/Istanbul" },
  { label: "Bursa", lat: 40.19, lon: 29.06, tz: "Europe/Istanbul" },
  { label: "Antalya", lat: 36.9, lon: 30.7, tz: "Europe/Istanbul" },
];

export function SettingsApp() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [cal, setCal] = useState<CalendarStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void (async () => {
      setSettings(await getSettings());
      setMonitors(await listMonitors());
      setCal(await calendarStatus());
    })().catch(console.error);
  }, []);

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0c0c0c] text-white/50">
        Yükleniyor…
      </div>
    );
  }

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings({ ...settings, [key]: value });
  };

  const persist = async () => {
    setSaving(true);
    setMsg("");
    try {
      const next = await saveSettings(settings);
      setSettings(next);
      setMsg("Kaydedildi");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[#0c0c0c] px-6 py-5 text-white" style={{ fontFamily: "Segoe UI Variable, Segoe UI, sans-serif" }}>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Ada Ayarları</h1>
        <p className="mt-1 text-sm text-white/45">Görünüm, widget’lar ve bağlantılar</p>
      </header>

      <section className="mb-6 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">Genel</h2>
        <label className="flex items-center justify-between gap-4 rounded-2xl bg-white/5 px-4 py-3">
          <span>Açılışta başlat</span>
          <Toggle checked={settings.autostart} onChange={(v) => update("autostart", v)} />
        </label>
        <label className="flex items-center justify-between gap-4 rounded-2xl bg-white/5 px-4 py-3">
          <span>Tam ekranda gizle</span>
          <Toggle
            checked={settings.hideOnFullscreen}
            onChange={(v) => update("hideOnFullscreen", v)}
          />
        </label>
        <label className="block rounded-2xl bg-white/5 px-4 py-3">
          <span className="mb-2 block text-sm text-white/70">Monitör</span>
          <select
            className="w-full rounded-xl border-0 bg-black/40 px-3 py-2 text-sm outline-none"
            value={settings.monitorId ?? ""}
            onChange={(e) =>
              update("monitorId", e.target.value === "" ? null : e.target.value)
            }
          >
            <option value="">Birincil monitör</option>
            {monitors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.isPrimary ? " (birincil)" : ""} — {m.width}×{m.height}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="mb-6 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Widget’lar
        </h2>
        {(
          [
            ["showMedia", "Müzik"],
            ["showWeather", "Hava durumu"],
            ["showCalendar", "Takvim"],
            ["showBattery", "Pil"],
            ["showClipboard", "Pano geçmişi"],
            ["showTimer", "Hesap makinesi"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex items-center justify-between gap-4 rounded-2xl bg-white/5 px-4 py-3"
          >
            <span>{label}</span>
            <Toggle checked={settings[key]} onChange={(v) => update(key, v)} />
          </label>
        ))}
      </section>

      <section className="mb-6 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Hava durumu
        </h2>
        <label className="block rounded-2xl bg-white/5 px-4 py-3">
          <span className="mb-2 block text-sm text-white/70">Şehir</span>
          <select
            className="w-full rounded-xl border-0 bg-black/40 px-3 py-2 text-sm outline-none"
            value={settings.weatherLabel}
            onChange={(e) => {
              const city = CITIES.find((c) => c.label === e.target.value);
              if (!city) return;
              setSettings({
                ...settings,
                weatherLabel: city.label,
                weatherLat: city.lat,
                weatherLon: city.lon,
                weatherTimezone: city.tz,
              });
            }}
          >
            {CITIES.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="mb-8 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Google Takvim
        </h2>
        <div className="rounded-2xl bg-white/5 px-4 py-3">
          <p className="text-sm text-white/60">
            {cal?.connected
              ? "Bağlı"
              : cal?.needsReauth
                ? "Yeniden bağlanman gerekiyor"
                : "Bağlı değil"}
          </p>
          <p className="mt-1 text-xs text-white/35">
            `.env` içine ADA_GOOGLE_CLIENT_ID / SECRET ekle (bkz. .env.example).
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
              onClick={() =>
                void calendarConnect()
                  .then(setCal)
                  .catch((e) => setMsg(String(e)))
              }
            >
              {cal?.connected || cal?.needsReauth ? "Yeniden bağlan" : "Bağlan"}
            </button>
            {cal?.connected && (
              <button
                type="button"
                className="rounded-full bg-white/10 px-4 py-2 text-sm"
                onClick={() =>
                  void calendarDisconnect()
                    .then(() => calendarStatus())
                    .then(setCal)
                    .catch(console.error)
                }
              >
                Bağlantıyı kes
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-white/10 bg-[#0c0c0c] py-4">
        <span className="text-sm text-white/45">{msg}</span>
        <button
          type="button"
          disabled={saving}
          onClick={() => void persist()}
          className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
        >
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition ${
        checked ? "bg-white" : "bg-white/20"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full transition ${
          checked ? "left-5 bg-black" : "left-0.5 bg-white"
        }`}
      />
    </button>
  );
}
