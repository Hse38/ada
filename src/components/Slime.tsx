import { motion } from "framer-motion";

/** Üstte ince damla — müzik çalarken hafif nabız */
export function Slime({ playing }: { playing: boolean }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <motion.div
        className="relative h-full w-full overflow-hidden"
        style={{
          borderRadius: 999,
          background:
            "linear-gradient(180deg, rgba(40,40,40,0.92) 0%, rgba(0,0,0,0.95) 100%)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
        }}
        animate={
          playing
            ? {
                scaleX: [1, 1.06, 0.98, 1.04, 1],
                scaleY: [1, 1.15, 0.9, 1.1, 1],
                opacity: [0.85, 1, 0.9, 1, 0.85],
              }
            : { scaleX: 1, scaleY: 1, opacity: 0.88 }
        }
        transition={
          playing
            ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.35 }
        }
      >
        {playing && (
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.18), transparent 70%)",
            }}
            animate={{ opacity: [0.15, 0.4, 0.15] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.div>
    </div>
  );
}
