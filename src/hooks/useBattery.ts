import { useEffect, useState } from "react";
import { getBattery, onBatteryUpdate, type BatteryInfo } from "../lib/tauri";

export function useBattery() {
  const [battery, setBattery] = useState<BatteryInfo | null>(null);

  useEffect(() => {
    void getBattery().then(setBattery).catch(console.error);
    let un: (() => void) | undefined;
    void onBatteryUpdate(setBattery).then((fn) => {
      un = fn;
    });
    return () => un?.();
  }, []);

  return battery;
}
