import { useEffect, useState } from "react";
import { onTimerUpdate, timerGet, type TimerInfo } from "../lib/tauri";

export function useTimer() {
  const [timer, setTimer] = useState<TimerInfo>({
    running: false,
    mode: "pomodoro",
    remainingSec: 25 * 60,
    totalSec: 25 * 60,
  });

  useEffect(() => {
    void timerGet().then(setTimer).catch(console.error);
    let un: (() => void) | undefined;
    void onTimerUpdate(setTimer).then((fn) => {
      un = fn;
    });
    return () => un?.();
  }, []);

  return timer;
}
