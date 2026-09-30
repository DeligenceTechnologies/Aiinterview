"use client";

import { formatClock } from "@/lib/format";

const COLORS = ["bg-indigo-400", "bg-sky-400", "bg-emerald-400", "bg-amber-400", "bg-rose-400", "bg-violet-400", "bg-teal-400", "bg-orange-400"];

/** Section markers on the interview clock; click anywhere to seek. */
export function InterviewTimeline({ sections, totalMs, currentMs, onSeek, markers = [] }: {
  sections: { id: string; name: string; start_ms: number | null; end_ms: number | null }[];
  totalMs: number;
  currentMs: number;
  onSeek: (ms: number) => void;
  markers?: { ms: number; label: string }[];
}) {
  if (totalMs <= 0) return null;
  const pct = (ms: number) => `${Math.min(100, Math.max(0, (ms / totalMs) * 100))}%`;
  return (
    <div className="space-y-1.5">
      <div
        role="slider"
        aria-label="Interview timeline"
        aria-valuemin={0}
        aria-valuemax={totalMs}
        aria-valuenow={currentMs}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") onSeek(Math.min(totalMs, currentMs + 5000));
          if (e.key === "ArrowLeft") onSeek(Math.max(0, currentMs - 5000));
        }}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onSeek(((e.clientX - r.left) / r.width) * totalMs);
        }}
        className="relative h-6 cursor-pointer overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {sections.filter((s) => s.start_ms != null).map((s, i) => (
          <div key={s.id} title={`${s.name} · ${formatClock(s.start_ms!)}`} className={`absolute inset-y-0 ${COLORS[i % COLORS.length]} opacity-40 hover:opacity-70`}
            style={{ left: pct(s.start_ms!), width: `calc(${pct((s.end_ms ?? totalMs) - s.start_ms!)} - 1px)` }} />
        ))}
        {markers.map((m, i) => (
          <div key={i} title={m.label} className="absolute top-0 h-2 w-0.5 bg-primary" style={{ left: pct(m.ms) }} />
        ))}
        <div className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: pct(currentMs) }} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {sections.filter((s) => s.start_ms != null).map((s, i) => (
          <button key={s.id} type="button" onClick={() => onSeek(s.start_ms!)} className="inline-flex items-center gap-1 hover:text-foreground">
            <span className={`size-2 rounded-sm ${COLORS[i % COLORS.length]}`} />{s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
