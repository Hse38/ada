import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";

type Op = "+" | "-" | "×" | "÷" | null;

function formatDisplay(n: number): string {
  if (!Number.isFinite(n)) return "Hata";
  const s = n.toPrecision(12).replace(/\.?0+$/, "");
  if (s.length > 12) return n.toExponential(5);
  return Number(s).toLocaleString("tr-TR", { maximumFractionDigits: 10 });
}

export function Calculator() {
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op>(null);
  const [fresh, setFresh] = useState(true);
  const stateRef = useRef({ display, acc, op, fresh });
  stateRef.current = { display, acc, op, fresh };

  const inputDigit = useCallback((d: string) => {
    setDisplay((prev) => {
      const { fresh: isFresh } = stateRef.current;
      if (isFresh || prev === "0" || prev === "Hata") {
        setFresh(false);
        return d;
      }
      if (prev.replace("-", "").replace(",", "").length >= 12) return prev;
      return prev + d;
    });
  }, []);

  const inputDot = useCallback(() => {
    setDisplay((prev) => {
      const { fresh: isFresh } = stateRef.current;
      if (isFresh || prev === "Hata") {
        setFresh(false);
        return "0,";
      }
      if (prev.includes(",")) return prev;
      return prev + ",";
    });
  }, []);

  const parse = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

  const apply = (a: number, b: number, operation: Op): number => {
    switch (operation) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "×":
        return a * b;
      case "÷":
        return b === 0 ? NaN : a / b;
      default:
        return b;
    }
  };

  const chooseOp = useCallback((next: Op) => {
    const { display: d, acc: a, op: curOp, fresh: isFresh } = stateRef.current;
    const cur = parse(d);
    if (a != null && curOp && !isFresh) {
      const result = apply(a, cur, curOp);
      setAcc(result);
      setDisplay(formatDisplay(result));
    } else {
      setAcc(cur);
    }
    setOp(next);
    setFresh(true);
  }, []);

  const equals = useCallback(() => {
    const { display: d, acc: a, op: curOp } = stateRef.current;
    if (a == null || !curOp) return;
    const result = apply(a, parse(d), curOp);
    setDisplay(formatDisplay(result));
    setAcc(null);
    setOp(null);
    setFresh(true);
  }, []);

  const clearAll = useCallback(() => {
    setDisplay("0");
    setAcc(null);
    setOp(null);
    setFresh(true);
  }, []);

  const backspace = useCallback(() => {
    if (stateRef.current.fresh) return;
    setDisplay((prev) => {
      if (prev.length <= 1 || (prev.length === 2 && prev.startsWith("-"))) {
        setFresh(true);
        return "0";
      }
      return prev.slice(0, -1);
    });
  }, []);

  const toggleSign = useCallback(() => {
    setDisplay((prev) => {
      if (prev === "0" || prev === "Hata") return prev;
      return prev.startsWith("-") ? prev.slice(1) : `-${prev}`;
    });
    setFresh(false);
  }, []);

  const percent = useCallback(() => {
    setDisplay(formatDisplay(parse(stateRef.current.display) / 100));
    setFresh(true);
  }, []);

  useEffect(() => {
    void getCurrentWindow().setFocus().catch(() => undefined);

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key;
      let handled = true;

      if (/^[0-9]$/.test(key)) inputDigit(key);
      else if (key === "." || key === ",") inputDot();
      else if (key === "+" || key === "Add") chooseOp("+");
      else if (key === "-" || key === "Subtract") chooseOp("-");
      else if (key === "*" || key === "Multiply" || key === "x" || key === "X")
        chooseOp("×");
      else if (key === "/" || key === "Divide") {
        e.preventDefault();
        chooseOp("÷");
      } else if (key === "Enter" || key === "=" || key === "NumpadEnter") {
        e.preventDefault();
        equals();
      } else if (key === "Backspace") {
        e.preventDefault();
        backspace();
      } else if (key === "Escape" || key === "Delete") clearAll();
      else if (key === "%") percent();
      else handled = false;

      if (handled) e.preventDefault();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputDigit, inputDot, chooseOp, equals, backspace, clearAll, percent]);

  const keys: {
    label: string;
    onClick: () => void;
    kind?: "op" | "eq" | "fn";
    active?: boolean;
  }[][] = [
    [
      { label: "AC", onClick: clearAll, kind: "fn" },
      { label: "⌫", onClick: backspace, kind: "fn" },
      { label: "%", onClick: percent, kind: "fn" },
      { label: "÷", onClick: () => chooseOp("÷"), kind: "op", active: op === "÷" && fresh },
    ],
    [
      { label: "7", onClick: () => inputDigit("7") },
      { label: "8", onClick: () => inputDigit("8") },
      { label: "9", onClick: () => inputDigit("9") },
      { label: "×", onClick: () => chooseOp("×"), kind: "op", active: op === "×" && fresh },
    ],
    [
      { label: "4", onClick: () => inputDigit("4") },
      { label: "5", onClick: () => inputDigit("5") },
      { label: "6", onClick: () => inputDigit("6") },
      { label: "−", onClick: () => chooseOp("-"), kind: "op", active: op === "-" && fresh },
    ],
    [
      { label: "1", onClick: () => inputDigit("1") },
      { label: "2", onClick: () => inputDigit("2") },
      { label: "3", onClick: () => inputDigit("3") },
      { label: "+", onClick: () => chooseOp("+"), kind: "op", active: op === "+" && fresh },
    ],
    [
      { label: "±", onClick: toggleSign, kind: "fn" },
      { label: "0", onClick: () => inputDigit("0") },
      { label: ",", onClick: inputDot },
      { label: "=", onClick: equals, kind: "eq" },
    ],
  ];

  return (
    <div className="flex h-full flex-col gap-2.5" tabIndex={-1}>
      <div className="px-1 pb-0.5 text-right">
        <p className="h-3.5 text-[10px] tabular-nums text-white/35">
          {acc != null && op ? `${formatDisplay(acc)} ${op}` : "\u00a0"}
        </p>
        <p className="truncate text-[30px] font-light tabular-nums leading-none tracking-tight text-white">
          {display}
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-5 gap-[7px]">
        {keys.flat().map((k, i) => {
          const base =
            "flex items-center justify-center rounded-full border-0 text-[15px] font-medium transition active:scale-90";
          let tone = "bg-[#333] text-white hover:bg-[#3f3f3f]";
          if (k.kind === "fn") tone = "bg-[#a5a5a5] text-black hover:bg-[#b8b8b8]";
          if (k.kind === "op" || k.kind === "eq") {
            tone = k.active
              ? "bg-white text-[#ff9f0a] hover:bg-white"
              : "bg-[#ff9f0a] text-white hover:bg-[#ffb340]";
          }
          return (
            <button
              key={`${i}-${k.label}`}
              type="button"
              onClick={k.onClick}
              className={`${base} ${tone}`}
            >
              {k.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
