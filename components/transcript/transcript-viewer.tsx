"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Segment = { id: string; section_id: string | null; speaker: "interviewer" | "candidate" | "system"; text: string; start_time_ms: number; end_time_ms: number };

function highlight(text: string, q: string) {
  if (!q) return text;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return parts.map((p, i) => (p.toLowerCase() === q.toLowerCase() ? <mark key={i} className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-700">{p}</mark> : p));
}

export function TranscriptSegment({ s, active, focused, onSeek, query, sectionName }: { s: Segment; active: boolean; focused: boolean; onSeek: (ms: number) => void; query: string; sectionName?: string }) {
  return (
    <div data-segment={s.id}>
      {sectionName && <p className="sticky top-0 z-10 bg-card/95 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">{sectionName}</p>}
      <button
        type="button"
        onClick={() => onSeek(s.start_time_ms)}
        className={cn(
          "block w-full px-4 py-2.5 text-left transition-colors hover:bg-muted/60",
          active && "bg-accent/60",
          focused && "ring-2 ring-inset ring-primary bg-accent",
        )}
      >
        <div className="mb-0.5 flex items-center gap-2 text-xs">
          <span className="font-mono tabular text-muted-foreground">{formatClock(s.start_time_ms)}</span>
          <span className={cn("font-semibold", s.speaker === "interviewer" ? "text-primary" : "text-foreground")}>{s.speaker === "interviewer" ? "Interviewer" : s.speaker === "candidate" ? "Candidate" : "System"}</span>
        </div>
        <p className="text-sm leading-relaxed">{highlight(s.text, query)}</p>
      </button>
    </div>
  );
}

export function TranscriptViewer({ segments, currentMs, focusedId, onSeek, sections, className }: {
  segments: Segment[] | null;
  currentMs: number;
  focusedId: string | null;
  onSeek: (ms: number, segmentId?: string) => void;
  sections: { id: string; name: string }[];
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [follow, setFollow] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => (segments ?? []).filter((s) => !q || s.text.toLowerCase().includes(q.toLowerCase())), [segments, q]);
  const activeId = useMemo(() => {
    let id: string | null = null;
    for (const s of segments ?? []) if (s.start_time_ms <= currentMs) id = s.id;
    return id;
  }, [segments, currentMs]);

  useEffect(() => {
    const id = focusedId ?? (follow ? activeId : null);
    if (!id || !box.current) return;
    const el = box.current.querySelector(`[data-segment="${id}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusedId, activeId, follow]);

  const sectionName = (s: Segment, i: number) => {
    const prev = filtered[i - 1];
    if (q || (prev && prev.section_id === s.section_id)) return undefined;
    return sections.find((x) => x.id === s.section_id)?.name;
  };

  return (
    <div className={cn("flex min-h-0 flex-col rounded-xl border bg-card", className)}>
      <div className="flex items-center gap-2 border-b p-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transcript" className="h-8 pl-8" aria-label="Search transcript" />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="accent-[var(--primary)]" /> Follow
        </label>
      </div>
      <div ref={box} className="min-h-0 flex-1 overflow-y-auto" onWheel={() => setFollow(false)}>
        {segments === null && <p className="p-6 text-center text-sm text-muted-foreground">Loading transcript…</p>}
        {segments?.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No transcript yet.</p>}
        {q && filtered.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No matches for “{q}”.</p>}
        {filtered.map((s, i) => (
          <TranscriptSegment key={s.id} s={s} query={q} active={s.id === activeId} focused={s.id === focusedId} sectionName={sectionName(s, i)} onSeek={(ms) => onSeek(ms, s.id)} />
        ))}
      </div>
    </div>
  );
}
