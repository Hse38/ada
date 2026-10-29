import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { formatTime, thumbnailSrc, type MediaInfo } from "../lib/tauri";
import { Waveform } from "./Waveform";

function Cover({
  media,
  size,
  radius = 12,
}: {
  media: MediaInfo;
  size: number;
  radius?: number;
}) {
  const src = thumbnailSrc(media.thumbnailBase64);
  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/10 text-white/40">
          <MusicGlyph size={22} />
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10"
        style={{ borderRadius: radius }}
      />
    </div>
  );
}

function MusicGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
    </svg>
  );
}

function TransportBtn({
  label,
  onClick,
  children,
  primary,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex items-center justify-center rounded-full border-0 transition active:scale-90 ${
        primary
          ? "h-12 w-12 bg-white text-black shadow-[0_4px_18px_rgb(255_255_255_/_0.18)] hover:scale-[1.03]"
          : "h-10 w-10 bg-transparent text-white/80 hover:bg-white/[0.08] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export function CompactMedia({ media }: { media: MediaInfo }) {
  return (
    <div className="flex w-full items-center gap-2.5 px-1.5">
      <Cover media={media} size={24} radius={7} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold leading-tight text-white">
          {media.title || "Bilinmeyen"}
        </p>
      </div>
      <Waveform playing={media.isPlaying} />
    </div>
  );
}

export function ExpandedMedia({
  media,
  positionMs,
  onPlayPause,
  onNext,
  onPrevious,
}: {
  media: MediaInfo;
  positionMs: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const progress =
    media.durationMs > 0
      ? Math.min(100, (positionMs / media.durationMs) * 100)
      : 0;
  const remaining = Math.max(0, media.durationMs - positionMs);
  const src = thumbnailSrc(media.thumbnailBase64);

  return (
    <div className="relative flex h-full flex-col justify-center overflow-hidden">
      {/* Kapaktan soft ambient — DynamicLake / Now Playing hissi */}
      {src && (
        <div
          aria-hidden
          className="pointer-events-none absolute -left-8 -top-10 h-48 w-48 opacity-40 blur-3xl"
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            maskImage:
              "radial-gradient(circle at center, black 20%, transparent 70%)",
            WebkitMaskImage:
              "radial-gradient(circle at center, black 20%, transparent 70%)",
          }}
        />
      )}

      <div className="relative flex items-stretch gap-4">
        <motion.div
          layout
          className="shrink-0"
          animate={media.isPlaying ? { scale: 1 } : { scale: 0.96 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
        >
          <Cover media={media} size={112} radius={16} />
        </motion.div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold leading-tight tracking-[-0.02em] text-white">
                {media.title || "Bilinmeyen şarkı"}
              </p>
              <div className="mt-0.5 flex min-w-0 items-center gap-2">
                <p className="truncate text-[12.5px] text-white/55">
                  {media.artist || "Bilinmeyen sanatçı"}
                </p>
                {media.sourceApp ? (
                  <>
                    <span className="text-white/25">·</span>
                    <span className="max-w-[7rem] shrink-0 truncate text-[10px] font-medium uppercase tracking-[0.07em] text-white/35">
                      {media.sourceApp}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            <div className="mt-1 shrink-0">
              <Waveform playing={media.isPlaying} />
            </div>
          </div>

          <div>
            <div className="relative flex h-3.5 items-center">
              <div className="h-[4px] w-full rounded-full bg-white/12">
                <div
                  className="relative h-full rounded-full bg-white transition-[width] duration-500 ease-linear"
                  style={{ width: `${progress}%` }}
                >
                  <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_3px_rgb(0_0_0_/_0.45)]" />
                </div>
              </div>
            </div>
            <div className="mt-1 flex justify-between text-[10.5px] tabular-nums text-white/40">
              <span>{formatTime(positionMs)}</span>
              <span>−{formatTime(remaining)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2.5">
            <TransportBtn label="Önceki" onClick={onPrevious}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2.2v12H6V6zm3.4 6 9.6 6.2V5.8L9.4 12z" />
              </svg>
            </TransportBtn>
            <TransportBtn
              label={media.isPlaying ? "Duraklat" : "Oynat"}
              onClick={onPlayPause}
              primary
            >
              {media.isPlaying ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#000">
                  <path d="M7 5h3.2v14H7V5zm6.8 0H17v14h-3.2V5z" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#000">
                  <path d="M8 5.5v13l11-6.5L8 5.5z" />
                </svg>
              )}
            </TransportBtn>
            <TransportBtn label="Sonraki" onClick={onNext}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.8 6H18v12h-2.2V6zM5 18.2 14.6 12 5 5.8v12.4z" />
              </svg>
            </TransportBtn>
          </div>
        </div>
      </div>
    </div>
  );
}
