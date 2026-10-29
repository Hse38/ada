import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBattery } from "../hooks/useBattery";
import { useCalendar } from "../hooks/useCalendar";
import { useFileDrop } from "../hooks/useFileDrop";
import { useIslandState } from "../hooks/useIslandState";
import { useMedia } from "../hooks/useMedia";
import { useSettings } from "../hooks/useSettings";
import { useWeather } from "../hooks/useWeather";
import { BatteryPill } from "./Battery";
import { CalendarPanel, UpcomingBadge } from "./Calendar";
import { CompactClock, ExpandedClock } from "./Clock";
import { HudOverlay } from "./Hud";
import { CompactMedia, ExpandedMedia } from "./MediaPlayer";
import { Slime } from "./Slime";
import { ToolsPanel } from "./Tools";
import { CompactWeather, ExpandedWeather } from "./Weather";

const spring = { type: "spring" as const, stiffness: 420, damping: 32 };

type Tab = "media" | "today" | "tools";

const TABS: Tab[] = ["media", "today", "tools"];
const TAB_LABEL: Record<Tab, string> = {
  media: "Müzik",
  today: "Bugün",
  tools: "Araçlar",
};

const WHEEL_COOLDOWN_MS = 280;

export function Island() {
  const { expanded, slime, compact, slimeSize, open } = useIslandState();
  const settings = useSettings();
  const { media, positionMs, controls } = useMedia(expanded);
  const weather = useWeather();
  const battery = useBattery();
  const calendar = useCalendar();
  const [tab, setTab] = useState<Tab>("media");
  const wheelLock = useRef(0);
  const shellRef = useRef<HTMLDivElement>(null);

  const { dragging } = useFileDrop(useCallback(() => undefined, []));

  const hasMedia = Boolean(settings.showMedia && (media?.title || media?.artist));
  const showWeather = settings.showWeather && weather;
  const showBattery = settings.showBattery && battery?.present;
  const upcoming = settings.showCalendar ? calendar.upcoming : null;
  const playing = Boolean(media?.isPlaying);

  const size = expanded ? open : slime ? slimeSize : compact;
  const radius = expanded ? 28 : slime ? 999 : 18;

  useEffect(() => {
    const el = shellRef.current;
    if (!el || !expanded) return;

    const onWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      if (now - wheelLock.current < WHEEL_COOLDOWN_MS) return;
      if (Math.abs(e.deltaY) < 8 && Math.abs(e.deltaX) < 8) return;
      wheelLock.current = now;

      const dir =
        (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) > 0
          ? 1
          : -1;
      setTab((cur) => {
        const i = TABS.indexOf(cur);
        return TABS[(i + dir + TABS.length) % TABS.length]!;
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [expanded]);

  return (
    <div className="relative flex h-full w-full items-start justify-center">
      <HudOverlay />
      <motion.div
        ref={shellRef}
        layout
        className={`relative overflow-hidden text-ink ${
          slime ? "" : "bg-island shadow-[0_10px_36px_rgb(0_0_0_/_0.4)]"
        } ${dragging ? "ring-2 ring-white/40" : ""}`}
        initial={false}
        animate={{
          width: size.width,
          height: size.height,
          borderRadius: radius,
        }}
        transition={spring}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/75 text-[13px] font-semibold text-white">
            Dosyaları bırak
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {expanded ? (
            <motion.div
              key="open"
              className="box-border flex h-full w-full flex-col bg-island px-4 pb-3 pt-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="mb-2 flex shrink-0 items-center justify-between gap-3 px-0.5">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={tab}
                    className="text-[11px] font-semibold tracking-[0.06em] text-white/45"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.14 }}
                  >
                    {TAB_LABEL[tab]}
                  </motion.p>
                </AnimatePresence>
                <div className="flex items-center gap-1.5" aria-hidden>
                  {TABS.map((id) => (
                    <span
                      key={id}
                      className={`h-1 rounded-full transition-all duration-200 ${
                        id === tab ? "w-3 bg-white/70" : "w-1 bg-white/22"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={tab}
                    className="h-full"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.16 }}
                  >
                    {tab === "media" &&
                      (hasMedia && media ? (
                        <ExpandedMedia
                          media={media}
                          positionMs={positionMs}
                          onPlayPause={controls.playPause}
                          onNext={controls.next}
                          onPrevious={controls.previous}
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2">
                          <ExpandedClock />
                          <p className="text-[12px] text-white/35">
                            Müzik çalınca burada görünecek
                          </p>
                        </div>
                      ))}

                    {tab === "today" && (
                      <div className="grid h-full grid-cols-2 gap-3">
                        <div className="flex flex-col justify-between rounded-2xl bg-white/[0.06] p-3">
                          {showWeather ? (
                            <ExpandedWeather weather={weather!} />
                          ) : (
                            <ExpandedClock />
                          )}
                          <div className="mt-3 flex items-center justify-between">
                            <CompactClock />
                            {showBattery && battery ? (
                              <BatteryPill battery={battery} />
                            ) : null}
                          </div>
                        </div>
                        <div className="flex min-h-0 flex-col rounded-2xl bg-white/[0.06] p-3">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45">
                            Takvim
                          </p>
                          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
                            {settings.showCalendar ? (
                              <CalendarPanel status={calendar} />
                            ) : (
                              <p className="text-[12px] text-white/40">
                                Takvim ayarlardan kapalı
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {tab === "tools" && (
                      <ToolsPanel showCalculator={settings.showTimer} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          ) : slime ? (
            <motion.div
              key="slime"
              className="h-full w-full"
              initial={{ opacity: 0, scaleY: 0.6 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0.6 }}
              transition={{ duration: 0.18 }}
            >
              <Slime playing={playing} />
            </motion.div>
          ) : (
            <motion.div
              key="compact"
              className="flex h-full w-full items-center gap-2 bg-island px-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              {upcoming ? (
                <UpcomingBadge event={upcoming} />
              ) : hasMedia && media ? (
                <CompactMedia media={media} />
              ) : (
                <div className="flex w-full items-center justify-between gap-2">
                  <CompactClock />
                  <div className="flex items-center gap-2">
                    {showWeather ? <CompactWeather weather={weather!} /> : null}
                    {showBattery && battery ? <BatteryPill battery={battery} /> : null}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
