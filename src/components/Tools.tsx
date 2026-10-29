import { Calculator } from "./Calculator";
import { QuickNotes } from "./Notes";

export function ToolsPanel({
  showCalculator,
}: {
  clipboard?: unknown;
  calendar?: unknown;
  showClipboard?: boolean;
  showCalculator: boolean;
  showCalendar?: boolean;
  files?: unknown;
  setFiles?: unknown;
  dragging?: boolean;
}) {
  return (
    <div className="relative grid h-full grid-cols-[1fr_1.15fr] gap-3 overflow-hidden">
      <QuickNotes />

      {showCalculator ? (
        <section className="flex min-h-0 flex-col overflow-hidden rounded-[18px] bg-white/[0.055] p-3">
          <Calculator />
        </section>
      ) : (
        <section className="flex items-center justify-center rounded-[18px] bg-white/[0.04] text-[12px] text-white/35">
          Hesap makinesi kapalı
        </section>
      )}
    </div>
  );
}
