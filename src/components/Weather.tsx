import type { WeatherInfo } from "../lib/tauri";

const ICONS: Record<string, string> = {
  clear: "☀",
  partly: "⛅",
  cloudy: "☁",
  fog: "fog",
  drizzle: "drizzle",
  rain: "🌧",
  snow: "❄",
  thunder: "⚡",
};

export function WeatherGlyph({ icon, className }: { icon: string; className?: string }) {
  const label = ICONS[icon] ?? "☁";
  if (label === "fog" || label === "drizzle") {
    return (
      <span className={className} aria-hidden>
        {label === "fog" ? "〰" : "🌦"}
      </span>
    );
  }
  return (
    <span className={className} aria-hidden>
      {label}
    </span>
  );
}

export function CompactWeather({ weather }: { weather: WeatherInfo }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-white/85">
      <WeatherGlyph icon={weather.icon} />
      <span className="tabular-nums font-medium">
        {Math.round(weather.temperature)}°
      </span>
    </div>
  );
}

export function ExpandedWeather({ weather }: { weather: WeatherInfo }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/8 text-2xl">
        <WeatherGlyph icon={weather.icon} />
      </div>
      <div>
        <p className="text-[28px] font-semibold leading-none tabular-nums">
          {Math.round(weather.temperature)}°
        </p>
        <p className="mt-1 text-[12px] text-white/55">
          {weather.label} · {Math.round(weather.low)}° / {Math.round(weather.high)}°
        </p>
      </div>
    </div>
  );
}
