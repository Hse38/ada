import { useClock } from "../hooks/useClock";

export function CompactClock() {
  const { time } = useClock();
  return (
    <span className="text-[13px] font-medium tracking-wide tabular-nums text-white">
      {time}
    </span>
  );
}

export function ExpandedClock() {
  const { time, date } = useClock();
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="text-[42px] font-semibold leading-none tracking-tight tabular-nums">
        {time}
      </span>
      <span className="text-[13px] capitalize text-white/60">{date}</span>
    </div>
  );
}
