import { useEffect, useState } from "react";
import {
  clipboardHistory,
  onClipboardUpdate,
  type ClipboardItem,
} from "../lib/tauri";

export function useClipboard() {
  const [items, setItems] = useState<ClipboardItem[]>([]);

  useEffect(() => {
    void clipboardHistory().then(setItems).catch(console.error);
    let un: (() => void) | undefined;
    void onClipboardUpdate(setItems).then((fn) => {
      un = fn;
    });
    return () => un?.();
  }, []);

  return items;
}
