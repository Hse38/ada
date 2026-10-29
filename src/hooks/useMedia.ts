import { useEffect, useRef, useState } from "react";
import {
  mediaGet,
  mediaNext,
  mediaPlayPause,
  mediaPrevious,
  onMediaUpdate,
  type MediaInfo,
} from "../lib/tauri";

export function useMedia(expanded: boolean) {
  const [media, setMedia] = useState<MediaInfo | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const baseRef = useRef({ position: 0, at: Date.now(), playing: false });

  useEffect(() => {
    void mediaGet()
      .then((info) => {
        setMedia(info);
        if (info) {
          setPositionMs(info.positionMs);
          baseRef.current = {
            position: info.positionMs,
            at: Date.now(),
            playing: info.isPlaying,
          };
        }
      })
      .catch((e) => console.error("[ada] media_get", e));

    let unlisten: (() => void) | undefined;
    void onMediaUpdate((info) => {
      setMedia(info);
      if (info) {
        setPositionMs(info.positionMs);
        baseRef.current = {
          position: info.positionMs,
          at: Date.now(),
          playing: info.isPlaying,
        };
      } else {
        setPositionMs(0);
        baseRef.current = { position: 0, at: Date.now(), playing: false };
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => unlisten?.();
  }, []);

  useEffect(() => {
    if (!expanded || !media?.isPlaying) return;

    const id = window.setInterval(() => {
      const { position, at, playing } = baseRef.current;
      if (!playing) return;
      const next = position + (Date.now() - at);
      const capped =
        media.durationMs > 0 ? Math.min(next, media.durationMs) : next;
      setPositionMs(capped);
    }, 1000);

    return () => window.clearInterval(id);
  }, [expanded, media?.isPlaying, media?.durationMs]);

  const controls = {
    playPause: () => void mediaPlayPause().catch(console.error),
    next: () => void mediaNext().catch(console.error),
    previous: () => void mediaPrevious().catch(console.error),
  };

  return { media, positionMs, controls };
}
