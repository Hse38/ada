import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { onHudShow, type HudEvent } from "../lib/tauri";

export function HudOverlay() {
  const [hud, setHud] = useState<HudEvent | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    let un: (() => void) | undefined;
    void onHudShow((ev) => {
      setHud(ev);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHud(null), 1500);
    }).then((fn) => {
      un = fn;
    });
    return () => {
      un?.();
      window.clearTimeout(timer);
    };
  }, []);

  const label =
    hud?.kind === "brightness"
      ? "Parlaklık"
      : hud?.muted
        ? "Sessiz"
        : "Ses";
  const pct = hud ? Math.round(hud.value * 100) : 0;
  const bar = hud?.muted && hud.kind === "volume" ? 0 : pct;

  return (
    <AnimatePresence>
      {hud && (
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-1 z-50 flex justify-center"
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
        >
          <div className="flex w-[210px] items-center gap-2 rounded-2xl bg-black px-3 py-2 shadow-[0_8px_24px_rgb(0_0_0_/_0.45)]">
            <span className="w-[58px] shrink-0 text-[11px] text-white/70">{label}</span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-150"
                style={{ width: `${bar}%` }}
              />
            </div>
            <span className="w-8 text-right text-[11px] tabular-nums text-white/60">
              {hud.muted && hud.kind === "volume" ? "—" : `${pct}`}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
