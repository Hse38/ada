import { useEffect, useState } from "react";
import {
  getSettings,
  onSettingsChanged,
  type AppSettings,
} from "../lib/tauri";

const defaults: AppSettings = {
  monitorId: null,
  autostart: true,
  hideOnFullscreen: true,
  showMedia: true,
  showWeather: true,
  showCalendar: true,
  showBattery: true,
  showClipboard: true,
  showTimer: true,
  weatherLat: 41.01,
  weatherLon: 28.97,
  weatherLabel: "İstanbul",
  weatherTimezone: "Europe/Istanbul",
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaults);

  useEffect(() => {
    void getSettings().then(setSettings).catch(console.error);
    let un: (() => void) | undefined;
    void onSettingsChanged(setSettings).then((fn) => {
      un = fn;
    });
    return () => un?.();
  }, []);

  return settings;
}
