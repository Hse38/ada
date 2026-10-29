import type { BatteryInfo } from "../lib/tauri";

export function BatteryPill({ battery }: { battery: BatteryInfo }) {
  if (!battery.present) return null;
  const low = battery.percent <= 20 && !battery.charging;
  return (
    <div
      className={`flex items-center gap-1 text-[11px] tabular-nums ${
        low ? "text-amber-300" : "text-white/70"
      }`}
      title={battery.charging ? "Şarj oluyor" : "Pil"}
    >
      <span className="relative inline-flex h-2.5 w-4 items-center rounded-[2px] border border-current px-[1px]">
        <span
          className="h-1 rounded-[1px] bg-current"
          style={{ width: `${Math.max(12, battery.percent)}%` }}
        />
      </span>
      {battery.charging ? "⚡" : null}
      {battery.percent}%
    </div>
  );
}
