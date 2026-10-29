import { useEffect, useState } from "react";
import { onWeatherUpdate, weatherGet, type WeatherInfo } from "../lib/tauri";

export function useWeather() {
  const [weather, setWeather] = useState<WeatherInfo | null>(null);

  useEffect(() => {
    void weatherGet().then(setWeather).catch(console.error);
    let un: (() => void) | undefined;
    void onWeatherUpdate(setWeather).then((fn) => {
      un = fn;
    });
    return () => un?.();
  }, []);

  return weather;
}
