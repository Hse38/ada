import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

const STORAGE_KEY = "ada-quick-notes";

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Note[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveNotes(notes: Note[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function previewLine(n: Note) {
  const t = n.title.trim() || n.body.trim().split("\n")[0] || "Boş not";
  return t.slice(0, 48);
}

const spring = { type: "spring" as const, stiffness: 420, damping: 34 };

export function QuickNotes() {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes());
  const [openId, setOpenId] = useState<string | "new" | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");

  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

  const openNote = useCallback((note: Note | null) => {
    if (note) {
      setOpenId(note.id);
      setDraftTitle(note.title);
      setDraftBody(note.body);
    } else {
      setOpenId("new");
      setDraftTitle("");
      setDraftBody("");
    }
  }, []);

  const closeAndSave = useCallback(() => {
    const title = draftTitle.trim();
    const body = draftBody.trim();
    const empty = !title && !body;

    setNotes((prev) => {
      if (openId === "new") {
        if (empty) return prev;
        return [
          {
            id: crypto.randomUUID(),
            title,
            body: draftBody,
            updatedAt: Date.now(),
          },
          ...prev,
        ];
      }
      if (typeof openId === "string") {
        if (empty) return prev.filter((n) => n.id !== openId);
        return prev.map((n) =>
          n.id === openId
            ? { ...n, title, body: draftBody, updatedAt: Date.now() }
            : n,
        );
      }
      return prev;
    });
    setOpenId(null);
  }, [draftTitle, draftBody, openId]);

  const removeOpen = useCallback(() => {
    if (typeof openId === "string" && openId !== "new") {
      setNotes((prev) => prev.filter((n) => n.id !== openId));
    }
    setOpenId(null);
  }, [openId]);

  const countLabel = useMemo(() => {
    const n = notes.length;
    if (n === 0) return "Henüz not yok";
    return `${n} not`;
  }, [notes.length]);

  const editing = openId !== null;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <motion.button
        type="button"
        layoutId="ada-note-sheet"
        onClick={() => openNote(null)}
        className="group relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border-0 p-0 text-left"
        style={{
          background:
            "linear-gradient(145deg, #3a4a6b 0%, #c45c4a 42%, #e8e4dc 100%)",
        }}
        transition={spring}
      >
        {/* Folder tab */}
        <div
          className="absolute right-3 top-0 h-3 w-16 rounded-t-[10px]"
          style={{
            background: "linear-gradient(180deg, #d8d4cc, #c8c4bc)",
          }}
        />

        <div className="mt-2.5 flex min-h-0 flex-1 flex-col rounded-[16px] border border-white/25 bg-white/82 p-3 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.5)] backdrop-blur-md">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[14px] font-bold tracking-tight text-black">
                Hızlı notlar
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-black/45">
                {countLabel}
              </p>
            </div>
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-black text-white shadow-[0_4px_12px_rgb(0_0_0_/_0.25)] transition group-hover:scale-105"
              aria-hidden
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z" />
              </svg>
            </span>
          </div>

          {notes.length === 0 ? (
            <p className="mt-auto text-[11px] text-black/40">
              Yazmaya başlamak için dokun
            </p>
          ) : (
            <ul
              className="no-scrollbar mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {notes.slice(0, 5).map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="w-full truncate rounded-[10px] border-0 bg-black/[0.05] px-2.5 py-1.5 text-left text-[11px] font-medium text-black/80 transition hover:bg-black/10"
                    onClick={() => openNote(n)}
                  >
                    {previewLine(n)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.button>

      <AnimatePresence>
        {editing && (
          <motion.div
            layoutId="ada-note-sheet"
            className="absolute inset-0 z-50 flex flex-col overflow-hidden rounded-[18px] bg-[#f4f1ea] text-black shadow-[0_20px_50px_rgb(0_0_0_/_0.45)]"
            transition={spring}
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-black/8 px-3 py-2.5">
              <input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Başlık"
                className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-semibold outline-none placeholder:text-black/30"
              />
              <div className="flex shrink-0 items-center gap-1">
                {openId !== "new" && (
                  <button
                    type="button"
                    onClick={removeOpen}
                    className="rounded-full border-0 bg-transparent px-2.5 py-1 text-[11px] font-medium text-red-600/80 hover:bg-red-500/10"
                  >
                    Sil
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeAndSave}
                  className="rounded-full border-0 bg-black px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-black/85 active:scale-95"
                >
                  Kaydet
                </button>
              </div>
            </div>
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              placeholder="Notunu yaz…"
              className="no-scrollbar min-h-0 flex-1 resize-none border-0 bg-transparent px-3 py-3 text-[13px] leading-relaxed outline-none placeholder:text-black/30"
            />
            <div className="flex items-center justify-between px-3 pb-2.5 text-[10px] text-black/35">
              <span>Esc ile kaydet & kapat</span>
              <button
                type="button"
                onClick={closeAndSave}
                className="rounded-full border-0 bg-black/5 px-2.5 py-1 font-medium text-black/55 hover:bg-black/10"
              >
                Kapat
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <NoteHotkeys open={editing} onSave={closeAndSave} />
    </div>
  );
}

function NoteHotkeys({
  open,
  onSave,
}: {
  open: boolean;
  onSave: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onSave();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onSave]);
  return null;
}
