import { motion } from "framer-motion";

const BARS = [0.4, 0.75, 0.5, 1, 0.6, 0.85, 0.45, 0.7];

export function Waveform({ playing }: { playing: boolean }) {
  return (
    <div className="flex h-4 items-end gap-[2.5px]" aria-hidden>
      {BARS.map((peak, i) => (
        <motion.span
          key={i}
          className="w-[2.5px] rounded-full bg-white/90"
          animate={
            playing
              ? {
                  height: ["24%", `${peak * 100}%`, "32%", `${peak * 80}%`, "24%"],
                  opacity: [0.55, 1, 0.7, 1, 0.55],
                }
              : { height: "30%", opacity: 0.35 }
          }
          transition={
            playing
              ? {
                  duration: 0.9 + i * 0.06,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.04,
                }
              : { duration: 0.28 }
          }
          style={{ height: "30%" }}
        />
      ))}
    </div>
  );
}
