import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import {
  filesImport,
  filesList,
  onFilesUpdate,
  type DroppedFile,
} from "../lib/tauri";

export function useFileDrop(onDrop?: () => void) {
  const [files, setFiles] = useState<DroppedFile[]>([]);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    void filesList().then(setFiles).catch(console.error);
    let unFiles: (() => void) | undefined;
    let unDrag: (() => void) | undefined;

    void onFilesUpdate(setFiles).then((fn) => {
      unFiles = fn;
    });

    void getCurrentWindow()
      .onDragDropEvent((event) => {
        const t = event.payload.type;
        if (t === "enter" || t === "over") {
          setDragging(true);
        } else if (t === "leave") {
          setDragging(false);
        } else if (t === "drop") {
          setDragging(false);
          const paths = event.payload.paths ?? [];
          if (paths.length === 0) return;
          void filesImport(paths)
            .then((list) => {
              setFiles(list);
              onDrop?.();
            })
            .catch(console.error);
        }
      })
      .then((fn) => {
        unDrag = fn;
      });

    return () => {
      unFiles?.();
      unDrag?.();
    };
  }, [onDrop]);

  return { files, setFiles, dragging };
}
