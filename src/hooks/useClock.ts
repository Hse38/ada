import { useEffect, useState } from "react";

function nowParts() {
  const d = new Date();
  const time = d.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = d.toLocaleDateString("tr-TR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return { time, date };
}

export function useClock() {
  const [parts, setParts] = useState(nowParts);

  useEffect(() => {
    const tick = () => setParts(nowParts());
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return parts;
}
