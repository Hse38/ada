import { useEffect, useState } from "react";
import {
  onIslandHover,
  onIslandLeave,
  onIslandPresence,
  setIslandBounds,
} from "../lib/tauri";

const SLIME = { width: 52, height: 10 };
const COMPACT = { width: 280, height: 40 };
const EXPANDED = { width: 740, height: 340 };

export function useIslandState() {
  const [expanded, setExpanded] = useState(false);
  const [slime, setSlime] = useState(false);

  useEffect(() => {
    let unHover: (() => void) | undefined;
    let unLeave: (() => void) | undefined;
    let unPresence: (() => void) | undefined;

    void (async () => {
      unHover = await onIslandHover(() => setExpanded(true));
      unLeave = await onIslandLeave(() => setExpanded(false));
      unPresence = await onIslandPresence((p) => setSlime(p.slime));
    })();

    return () => {
      unHover?.();
      unLeave?.();
      unPresence?.();
    };
  }, []);

  useEffect(() => {
    const size = expanded ? EXPANDED : slime ? SLIME : COMPACT;
    void setIslandBounds(size.width, size.height).catch(console.error);
  }, [expanded, slime]);

  return {
    expanded,
    slime: slime && !expanded,
    compact: COMPACT,
    slimeSize: SLIME,
    open: EXPANDED,
  };
}
