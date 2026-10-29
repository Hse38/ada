import { useMemo, useState } from "react";
import type { CalendarEvent, CalendarStatus } from "../lib/tauri";
import { calendarConnect } from "../lib/tauri";

const WEEKDAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pa"];

function formatWhen(ev: CalendarEvent) {
  if (ev.allDay) return "Tüm gün";
  const d = new Date(ev.start);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(ev: CalendarEvent) {
  const d = new Date(ev.start);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Bugün";
  if (d.toDateString() === tomorrow.toDateString()) return "Yarın";
  return d.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric" });
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function UpcomingBadge({ event }: { event: CalendarEvent }) {
  return (
    <div className="flex max-w-[160px] items-center gap-1.5 truncate rounded-full bg-white/10 px-2 py-0.5 text-[11px]">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
      <span className="truncate">
        {evMinutes(event)} · {event.title}
      </span>
    </div>
  );
}

function evMinutes(ev: CalendarEvent) {
  if (ev.minutesUntil <= 0) return "şimdi";
  return `${ev.minutesUntil} dk`;
}

function MonthView({
  events = [],
  cursor,
  onPrev,
  onNext,
}: {
  events?: CalendarEvent[];
  cursor: Date;
  onPrev: () => void;
  onNext: () => void;
}) {
  const today = new Date();
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const eventDays = useMemo(() => {
    const set = new Set<string>();
    for (const ev of events) {
      const d = new Date(ev.start);
      if (d.getFullYear() === year && d.getMonth() === month) {
        set.add(dayKey(d));
      }
    }
    return set;
  }, [events, year, month]);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    // Monday = 0 … Sunday = 6
    const startPad = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: ({ day: number; inMonth: true } | { day: number; inMonth: false })[] = [];
    for (let i = 0; i < startPad; i++) out.push({ day: 0, inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) out.push({ day: d, inMonth: true });
    while (out.length % 7 !== 0) out.push({ day: 0, inMonth: false });
    return out;
  }, [year, month]);

  const title = cursor.toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <button
          type="button"
          aria-label="Önceki ay"
          onClick={onPrev}
          className="flex h-6 w-6 items-center justify-center rounded-full border-0 bg-transparent text-white/45 transition hover:bg-white/10 hover:text-white"
        >
          ‹
        </button>
        <p className="text-[12px] font-semibold capitalize tracking-wide text-white/85">
          {title}
        </p>
        <button
          type="button"
          aria-label="Sonraki ay"
          onClick={onNext}
          className="flex h-6 w-6 items-center justify-center rounded-full border-0 bg-transparent text-white/45 transition hover:bg-white/10 hover:text-white"
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-y-0.5">
        {WEEKDAYS.map((w) => (
          <span
            key={w}
            className="text-center text-[9px] font-medium uppercase tracking-wide text-white/35"
          >
            {w}
          </span>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-y-0.5">
        {cells.map((cell, i) => {
          if (!cell.inMonth || cell.day === 0) {
            return <span key={`e-${i}`} />;
          }
          const date = new Date(year, month, cell.day);
          const isToday =
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate();
          const hasEv = eventDays.has(dayKey(date));

          return (
            <div
              key={cell.day}
              className="relative flex items-center justify-center"
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] tabular-nums ${
                  isToday
                    ? "bg-white font-semibold text-black"
                    : "text-white/75"
                }`}
              >
                {cell.day}
              </span>
              {hasEv && !isToday && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-amber-300" />
              )}
              {hasEv && isToday && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-black/50" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarPanel({
  status,
  compact,
}: {
  status: CalendarStatus;
  compact?: boolean;
}) {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const shiftMonth = (delta: number) => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };

  if (!status.connected) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="min-h-0 flex-1">
          <MonthView
            cursor={cursor}
            onPrev={() => shiftMonth(-1)}
            onNext={() => shiftMonth(1)}
          />
        </div>
        <button
          type="button"
          className="w-full shrink-0 truncate rounded-full border-0 bg-white px-3 py-1.5 text-[11px] font-semibold text-black transition hover:bg-white/90 active:scale-95"
          onClick={() => void calendarConnect().catch(alert)}
        >
          {status.needsReauth ? "Yeniden bağlan" : "Google’a bağlan"}
        </button>
      </div>
    );
  }

  if (status.events.length === 0) {
    return (
      <MonthView
        events={status.events}
        cursor={cursor}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
      />
    );
  }

  const limit = compact ? 3 : 5;

  return (
    <ul className="no-scrollbar flex h-full flex-col gap-1.5 overflow-y-auto">
      {status.events.slice(0, limit).map((ev) => (
        <li
          key={ev.id}
          className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] px-2.5 py-1.5"
        >
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-white">{ev.title}</p>
            <p className="text-[10px] text-white/40">{formatDay(ev)}</p>
          </div>
          <span className="shrink-0 rounded-md bg-white/8 px-1.5 py-0.5 text-[11px] tabular-nums text-white/70">
            {formatWhen(ev)}
          </span>
        </li>
      ))}
    </ul>
  );
}
