import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dice6, Sparkles, Lock, FileDown, CheckCircle2 } from "lucide-react";

/**
 * Panda Royale – Personal Score Sheet – Arcade v4.0
 * - Permanent DARK mode
 * - Table-only layout
 * - Mobile: side scroll when needed; collapsed borders (no visual gaps)
 * - Red Dice Picker modal:
 *     • Click the Red cell (or the ⚙️ button next to it) to open
 *     • Adjust "# of red dice" with + / −
 *     • Persists immediately for future rounds (uses global defaultRedCount)
 *     • Current round snapshots on "Done" (unchanged behavior)
 * - Inputs show full numbers (tabular-nums + ~5.5ch)
 * - Features: Done/lock per round, CSV export, reset confirm, Round 1 = yellow-only,
 *   row total only when locked, final total after all locked, ± for Red Sum
 */

const LS_KEY = "pandaRoyale_personal_v40_vite";
const ROUNDS = 10;

const clampNum = (n) => (Number.isFinite(+n) ? +n : 0);
const makeBlankRow = () => ({
  y: 0, purp: 0, blue: 0, redSum: 0, redCount: 0, green: 0, clear: 0, pink: 0, locked: false
});
const makeBlankRows = (n = ROUNDS) => Array.from({ length: n }, makeBlankRow);

// ---- calculations
function computeRowTotal(row, hasGlitterBlue) {
  const y = clampNum(row.y);
  const p = clampNum(row.purp) * 2;
  const b = clampNum(row.blue) * (hasGlitterBlue ? 2 : 1);
  const red = clampNum(row.redSum) * clampNum(row.redCount);
  const g = clampNum(row.green);
  const c = clampNum(row.clear);
  const k = clampNum(row.pink);
  return y + p + b + red + g + c + k;
}

function buildCsvString(playerName, rows, hasGlitterBlue, gameTotal) {
  const header = [
    "Round","Yellow","Purple(x2)","Blue" + (hasGlitterBlue ? "(x2 glitter)" : ""),
    "Red Sum","Red Count","Green","Clear/White","Pink (Pity)","Row Total"
  ].join(",");
  const lines = rows.map((r, i) => [
    i + 1, r.y, r.purp * 2, hasGlitterBlue ? r.blue * 2 : r.blue,
    r.redSum, r.redCount || 0, r.green, r.clear, r.pink, computeRowTotal(r, hasGlitterBlue)
  ].join(","));
  const footer = ["","","","","","","","","Total", gameTotal].join(",");
  return [header, ...lines, footer].join("\n");
}

// ---- UI atoms
const AButton = ({ className = "", variant = "solid", children, ...props }) => (
  <button
    className={
      (variant === "solid"
        ? "bg-gradient-to-r from-indigo-500 to-cyan-400 text-white "
        : "bg-zinc-900 text-zinc-100 border border-zinc-800 ") +
      "px-3 py-2 text-sm rounded-2xl shadow-sm transition active:scale-[.98] hover:brightness-110 " +
      className
    }
    {...props}
  >{children}</button>
);

const AInput = (props) => (
  <input
    {...props}
    className={
      "px-2 py-1 text-sm rounded-md bg-zinc-900 border border-zinc-800 outline-none " +
      "focus:ring-2 focus:ring-cyan-400/50 text-zinc-100 tabular-nums " +
      (props.className || "")
    }
  />
);

const DiceChip = ({ label, color }) => (
  <span
    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold shadow-sm ring-1 ring-black/10"
    style={{ background: color.bg, color: color.fg, border: `1px solid ${color.bd}` }}
  >
    <Sparkles className="w-3 h-3 opacity-80" />
    {label}
  </span>
);

const COLORS = {
  yellow: { bg: "#FEF9C3", fg: "#713F12", bd: "#FDE68A" },
  purple: { bg: "#E9D5FF", fg: "#5B21B6", bd: "#D8B4FE" },
  blue:   { bg: "#CFFAFE", fg: "#0E7490", bd: "#A5F3FC" },
  red:    { bg: "#FECACA", fg: "#7F1D1D", bd: "#FCA5A5" },
  green:  { bg: "#DCFCE7", fg: "#14532D", bd: "#BBF7D0" },
  clear:  { bg: "#F1F5F9", fg: "#334155", bd: "#E2E8F0" },
  pink:   { bg: "#FCE7F3", fg: "#9D174D", bd: "#FBCFE8" },
};

export default function App() {
  const [rows, setRows] = useState(() => makeBlankRows());
  const [activeRound, setActiveRound] = useState(0);
  const [defaultRedCount, setDefaultRedCount] = useState(0);
  const [playerName, setPlayerName] = useState("Player");
  const [hasGlitterBlue, setHasGlitterBlue] = useState(false);

  // Red Dice Picker modal
  const [redPickerOpen, setRedPickerOpen] = useState(false);
  const [redPickerRound, setRedPickerRound] = useState(null); // which round opened it from (for UX highlight)

  // Force dark mode globally
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Load user data
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (saved) {
        setRows(saved.rows || rows);
        setActiveRound(saved.activeRound || 0);
        setDefaultRedCount(saved.defaultRedCount ?? 0);
        setPlayerName(saved.playerName || "Player");
        setHasGlitterBlue(!!saved.hasGlitterBlue);
      }
    } catch {}
  }, []);

  // Persist
  useEffect(() => {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ rows, activeRound, defaultRedCount, playerName, hasGlitterBlue })
    );
  }, [rows, activeRound, defaultRedCount, playerName, hasGlitterBlue]);

  const rowTotals = useMemo(() => rows.map((r) => computeRowTotal(r, hasGlitterBlue)), [rows, hasGlitterBlue]);
  const allLocked = rows.every((r) => r.locked);
  const gameTotal = rowTotals.reduce((a, b) => a + b, 0);

  const setField = (roundIdx, key, val) => {
    if (rows[roundIdx].locked) return;
    setRows((prev) => {
      const copy = [...prev];
      copy[roundIdx] = { ...copy[roundIdx], [key]: val };
      return copy;
    });
  };

  const doneRound = () => {
    setRows((prev) => {
      const copy = [...prev];
      copy[activeRound] = { ...copy[activeRound], redCount: defaultRedCount, locked: true };
      return copy;
    });
    setActiveRound((prev) => Math.min(prev + 1, ROUNDS - 1));
  };

  const resetAll = () => {
    if (!confirm("Start a new game? This will clear all 10 rounds and unlock everything.")) return;
    const freshRows = makeBlankRows();
    setRows(freshRows);
    setActiveRound(0);
    setDefaultRedCount(0);
    setHasGlitterBlue(false);
    setPlayerName("Player");
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        rows: freshRows, activeRound: 0, defaultRedCount: 0, playerName: "Player", hasGlitterBlue: false
      }));
    } catch {}
  };

  const exportCSV = () => {
    const csv = buildCsvString(playerName, rows, hasGlitterBlue, gameTotal);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${playerName || "panda_royale"}-scores.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Tight mobile sizing
  const tableTextSize = "text-xs sm:text-sm";
  const cellPad = "p-1 sm:p-2";
  const inputWidth = "w-[5.5ch]"; // wide enough for 3 digits + minus

  // Open red picker from a row (only if not locked & not round1)
  const openRedPicker = (roundIdx) => {
    const r = rows[roundIdx];
    const isRound1 = roundIdx === 0;
    if (r.locked || isRound1) return;
    setRedPickerRound(roundIdx);
    setRedPickerOpen(true);
  };

  return (
    <div className={"bg-zinc-950 text-zinc-100 min-h-screen p-4 sm:p-8 pb-28"}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <motion.header
          layout
          className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6 shadow-md"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-[0_10px_25px_-10px_rgba(99,102,241,.8)]">
                <Dice6 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Panda Royale – Score Sheet
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <DiceChip label="Yellow" color={COLORS.yellow} />
                  <DiceChip label="Purple×2" color={COLORS.purple} />
                  <DiceChip label={`Blue${hasGlitterBlue ? "×2" : ""}`} color={COLORS.blue} />
                  <DiceChip label="Red±" color={COLORS.red} />
                  <DiceChip label="Green" color={COLORS.green} />
                  <DiceChip label="Clear" color={COLORS.clear} />
                  <DiceChip label="Pink" color={COLORS.pink} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AButton variant="ghost" onClick={exportCSV}><FileDown className="inline w-4 h-4 mr-1" />Export CSV</AButton>
              <AButton variant="ghost" className="border border-red-500/40 text-red-300" onClick={resetAll}>Reset</AButton>
            </div>
          </div>

          {/* Round stepper */}
          <div className="mt-4 grid grid-cols-10 gap-1">
            {Array.from({ length: ROUNDS }).map((_, i) => (
              <div key={i} className={`h-2 rounded-full ${i <= activeRound ? "bg-gradient-to-r from-indigo-400 to-cyan-400" : "bg-zinc-800"}`} />
            ))}
          </div>
        </motion.header>

        {/* Controls */}
        <section className="rounded-3xl shadow-md bg-zinc-900 border border-zinc-800 p-3 sm:p-6">
          <div className="grid gap-2 sm:gap-3 sm:grid-cols-[1fr_auto_auto_auto] items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm opacity-80">Name:</span>
              <AInput value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Player" className="w-32 sm:w-48" />
            </div>
            <label className="flex items-center gap-2 text-xs sm:text-sm">
              <input type="checkbox" checked={hasGlitterBlue} onChange={(e) => setHasGlitterBlue(e.target.checked)} />
              Owns glitter blue (Blue ×2)
            </label>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span># Red Dice (default):</span>
              <AInput
                value={String(defaultRedCount)}
                inputMode="numeric"
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const onlyDigits = (e.target.value || "").replace(/\D+/g, "");
                  const capped = onlyDigits.slice(0, 2); // 0–99
                  const n = parseInt(capped || "0", 10);
                  setDefaultRedCount(Number.isFinite(n) ? n : 0);
                }}
                className="w-[5.5ch] text-right"
              />
            </div>
            <div className="text-[11px] sm:text-xs opacity-80">Round 1: Yellow only • Press <strong>Done</strong> to lock</div>
          </div>
        </section>

        {/* TABLE */}
        <section className="rounded-3xl shadow-md bg-zinc-900 border border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch] -mx-2 px-2 sm:mx-0 sm:px-0">
            <table className={`w-full table-auto border-collapse min-w-[780px] sm:min-w-0 ${tableTextSize}`}>
              <colgroup>
                <col style={{ width: "6ch" }} />   {/* Round */}
                <col style={{ width: "8ch" }} />   {/* Yellow */}
                <col style={{ width: "8ch" }} />   {/* Purple */}
                <col style={{ width: "8ch" }} />   {/* Blue */}
                <col style={{ width: "11.5ch" }} />{/* Red Sum (± + ⚙) */}
                <col style={{ width: "8ch" }} />   {/* Green */}
                <col style={{ width: "9ch" }} />   {/* Clear/White */}
                <col style={{ width: "9ch" }} />   {/* Pink */}
                <col style={{ width: "9ch" }} />   {/* Row Total */}
                <col style={{ width: "11ch" }} />  {/* Action */}
              </colgroup>

              <thead className="bg-zinc-800/70">
                <tr className="border-b border-zinc-800">
                  <Th>Rnd</Th>
                  <Th>Yellow</Th>
                  <Th>Purp</Th>
                  <Th>Blue</Th>
                  <Th>Red</Th>
                  <Th>Green</Th>
                  <Th>Clear</Th>
                  <Th>Pink</Th>
                  <Th>Total</Th>
                  <Th>Action</Th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-800">
                {rows.map((r, i) => {
                  const isActive = i === activeRound;
                  const isRound1 = i === 0;
                  return (
                    <tr key={i} className="odd:bg-zinc-900 even:bg-zinc-900/80">
                      <td className={cellPad + " font-medium"}>{i + 1}</td>

                      <CellNumber value={r.y} onChange={(v) => setField(i, "y", v)} disabled={r.locked || !isActive} />

                      <CellNumber value={r.purp} onChange={(v) => setField(i, "purp", v)} disabled={r.locked || !isActive || isRound1} />

                      <CellNumber value={r.blue} onChange={(v) => setField(i, "blue", v)} disabled={r.locked || !isActive || isRound1} />

                      {/* Red Sum cell: input + ± + gear to open picker; clicking the cell background also opens (when active) */}
                      <td
                        className={
                          cellPad +
                          " " +
                          (r.locked || !isActive || isRound1 ? "opacity-40 cursor-not-allowed " : "cursor-pointer ") +
                          "align-middle"
                        }
                        onClick={() => openRedPicker(i)}
                      >
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <NumberInput
                            value={r.redSum}
                            onChange={(v) => setField(i, "redSum", v)}
                            disabled={r.locked || !isActive || isRound1}
                          />
                          {!r.locked && isActive && !isRound1 && (
                            <>
                              <TinyGhostButton onClick={() => setField(i, "redSum", -(Number(r.redSum) || 0))} aria="Toggle sign">±</TinyGhostButton>
                              <TinyGhostButton onClick={() => openRedPicker(i)} aria="Open red dice picker">⚙️</TinyGhostButton>
                            </>
                          )}
                        </div>
                        {/* Effective red dice count preview for this row */}
                        <div className="text-[10px] opacity-70 mt-1">
                          Red dice: {r.locked ? (r.redCount || 0) : defaultRedCount}
                        </div>
                      </td>

                      <CellNumber value={r.green} onChange={(v) => setField(i, "green", v)} disabled={r.locked || !isActive || isRound1} />

                      <CellNumber value={r.clear} onChange={(v) => setField(i, "clear", v)} disabled={r.locked || !isActive || isRound1} />

                      <CellNumber value={r.pink} onChange={(v) => setField(i, "pink", v)} disabled={r.locked || !isActive || isRound1} />

                      <td className={cellPad + " font-semibold"}>
                        <AnimatePresence mode="popLayout">
                          {r.locked ? (
                            <motion.span
                              key="total"
                              initial={{ scale: 0.85, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="inline-flex items-center gap-1"
                            >
                              {rowTotals[i]}
                              <Lock className="w-3 h-3 opacity-60" />
                            </motion.span>
                          ) : null}
                        </AnimatePresence>
                      </td>

                      <td className={cellPad}>
                        {isActive && !r.locked ? (
                          <AButton onClick={doneRound}><CheckCircle2 className="inline w-4 h-4 mr-1" />Done</AButton>
                        ) : (
                          <span className="text-[10px] opacity-60">{r.locked ? "Locked" : ""}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {rows.every((r) => r.locked) && (
                  <tr className="bg-zinc-800/70">
                    <td className={cellPad + " text-right font-semibold"} colSpan={8}>Game Total</td>
                    <td className={cellPad + " font-black text-cyan-300"}>{gameTotal}</td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ---- Red Dice Picker Modal ---- */}
      <AnimatePresence>
        {redPickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setRedPickerOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 20 }}
              className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-sm opacity-80 mb-2">
                {typeof redPickerRound === "number" ? `Round ${redPickerRound + 1}` : "Red Dice"}
              </div>
              <div className="text-lg font-semibold mb-3">Number of Red Dice</div>
              <div className="flex items-center justify-center gap-3 mb-4">
                <AButton variant="ghost" className="px-3 py-2 text-lg" onClick={() => setDefaultRedCount((n) => Math.max(0, (n || 0) - 1))}>−</AButton>
                <div className="min-w-[4ch] text-center text-2xl font-bold tabular-nums">{defaultRedCount}</div>
                <AButton variant="ghost" className="px-3 py-2 text-lg" onClick={() => setDefaultRedCount((n) => Math.min(99, (n || 0) + 1))}>+</AButton>
              </div>
              <div className="text-xs opacity-70 mb-4 text-center">
                This becomes the default and will be snapshotted when you press <strong>Done</strong>.
              </div>
              <div className="flex justify-end gap-2">
                <AButton variant="ghost" onClick={() => setRedPickerOpen(false)}>Close</AButton>
                <AButton onClick={() => setRedPickerOpen(false)}>OK</AButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- helpers ---------- */

function Th({ children }) {
  return <th className={"text-left p-1 sm:p-2 font-semibold text-zinc-200"}>{children}</th>;
}

function TinyGhostButton({ onClick, children, aria }) {
  return (
    <button
      type="button"
      aria-label={aria}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="px-1.5 py-1 text-[10px] rounded-md border border-zinc-800 bg-zinc-900 text-zinc-100 hover:brightness-110"
    >
      {children}
    </button>
  );
}

function NumberInput({ value, onChange, disabled }) {
  const handle = (e) => {
    if (disabled) return;
    let raw = (e.target.value || "").toString();
    let sign = "";
    if (raw.startsWith("-")) { sign = "-"; raw = raw.slice(1); }
    const digits = raw.replace(/\D+/g, "").slice(0, 3); // cap 3 digits
    if (digits === "" && sign) { onChange(-0); return; }
    const n = parseInt((sign ? "-" : "") + (digits || "0"), 10);
    onChange(Number.isFinite(n) ? n : 0);
  };
  return (
    <input
      type="text"
      className={
        "w-[5.5ch] px-2 py-1 text-right rounded-md border " +
        "bg-zinc-900 border-zinc-800 outline-none focus:ring-2 focus:ring-cyan-400/50 " +
        "text-zinc-100 tabular-nums font-medium"
      }
      value={value}
      onChange={handle}
      onFocus={(e) => e.target.select()}
      inputMode="numeric"
      disabled={disabled}
      aria-label="red-sum"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function CellNumber({ value, onChange, allowNegative = false, disabled = false }) {
  const handle = (e) => {
    if (disabled) return;
    let raw = (e.target.value || "").toString();
    let sign = "";
    if (allowNegative && raw.startsWith("-")) { sign = "-"; raw = raw.slice(1); }
    const digits = raw.replace(/\D+/g, "").slice(0, 3); // cap 3 digits
    if (digits === "" && sign) { onChange(-0); return; }
    const n = parseInt((sign ? "-" : "") + (digits || "0"), 10);
    onChange(Number.isFinite(n) ? n : 0);
  };
  const toggleSign = () => {
    if (disabled) return;
    const n = Number(value) || 0;
    onChange(-n);
  };
  const cellPad = "p-1 sm:p-2";
  return (
    <td className={`${cellPad} ${disabled ? "opacity-40" : ""}`}>
      <div className="flex items-center gap-1">
        <input
          type="text"
          className={
            "w-[5.5ch] px-2 py-1 text-right rounded-md border " +
            "bg-zinc-900 border-zinc-800 outline-none focus:ring-2 focus:ring-cyan-400/50 " +
            "text-zinc-100 tabular-nums font-medium"
          }
          value={value}
          onChange={handle}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          disabled={disabled}
          aria-label="score"
        />
        {allowNegative && !disabled && (
          <TinyGhostButton onClick={toggleSign} aria="Toggle sign">±</TinyGhostButton>
        )}
      </div>
    </td>
  );
}
