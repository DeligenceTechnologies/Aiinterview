"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/common/states";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { APPLICATION_STATUS, MatchBadge } from "./match-badge";

type Row = {
  id: string; job_id: string; status: string; created_at: string; screening_status: string; match_level: string | null;
  requirements_met: number | null; requirements_total: number | null; candidate_name: string; candidate_email: string;
};

const MATCH_FILTERS = [
  { v: "", l: "All" }, { v: "strong_match", l: "Strong" }, { v: "good_match", l: "Good" }, { v: "partial_match", l: "Partial" },
  { v: "low_match", l: "Low" }, { v: "insufficient_information", l: "Not enough info" },
];
const ORDER: Record<string, number> = { strong_match: 5, good_match: 4, partial_match: 3, low_match: 2, insufficient_information: 1 };

export function ApplicationsTable({ rows }: { rows: Row[] }) {
  const [match, setMatch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"recent" | "match">("recent");
  const shown = useMemo(() => {
    const r = rows.filter((x) => (!match || x.match_level === match) && (!status || x.status === status));
    return sort === "match" ? [...r].sort((a, b) => (ORDER[b.match_level ?? ""] ?? 0) - (ORDER[a.match_level ?? ""] ?? 0)) : r;
  }, [rows, match, status, sort]);

  if (!rows.length) return <div className="p-5"><EmptyState icon={Inbox} title="No applications yet" description="Turn on the public application link and share it on job boards, LinkedIn or your careers page." /></div>;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
        <div className="flex flex-wrap gap-1">
          {MATCH_FILTERS.map((f) => (
            <button key={f.v} type="button" onClick={() => setMatch(f.v)} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", match === f.v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
              {f.l}{f.v && ` · ${rows.filter((r) => r.match_level === f.v).length}`}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-7 rounded-md border border-input bg-background px-2 text-xs">
            <option value="">All statuses</option>
            {Object.entries(APPLICATION_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as "recent" | "match")} className="h-7 rounded-md border border-input bg-background px-2 text-xs">
            <option value="recent">Newest first</option>
            <option value="match">By AI match</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr><th className="px-4 py-2.5 font-medium">Applicant</th><th className="px-4 py-2.5 font-medium">AI screening</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 text-right font-medium">Applied</th></tr>
          </thead>
          <tbody className="divide-y">
            {shown.map((a) => (
              <tr key={a.id} className="group relative hover:bg-muted/40">
                <td className="px-4 py-3">
                  <Link href={`/jobs/${a.job_id}/applications/${a.id}`} className="font-medium after:absolute after:inset-0 group-hover:text-primary">{a.candidate_name}</Link>
                  <p className="text-xs text-muted-foreground">{a.candidate_email}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <MatchBadge level={a.match_level} screeningStatus={a.screening_status} />
                    {a.requirements_total ? <span className="text-xs text-muted-foreground tabular">{a.requirements_met}/{a.requirements_total} requirements</span> : null}
                  </div>
                </td>
                <td className="px-4 py-3"><span className={cn("text-xs font-medium", a.status === "new" ? "text-primary" : a.status === "declined" ? "text-muted-foreground" : "")}>{APPLICATION_STATUS[a.status]}</span></td>
                <td className="px-4 py-3 text-right text-muted-foreground">{timeAgo(a.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <p className="p-6 text-center text-sm text-muted-foreground">No applications match these filters.</p>}
      </div>
    </>
  );
}
