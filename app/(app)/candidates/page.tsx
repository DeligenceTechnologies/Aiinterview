import Link from "next/link";
import { Suspense } from "react";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { SearchBar } from "@/components/common/search-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/states";
import { NewCandidateDialog } from "@/components/candidates/new-candidate-dialog";
import { can } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { initials, timeAgo } from "@/lib/format";
import { listCandidates } from "@/lib/services/candidates";

export const metadata = { title: "Candidates" };

export default async function CandidatesPage(props: PageProps<"/candidates">) {
  const auth = await requireAuth("candidate:view");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const page = Number(sp.page ?? 1) || 1;
  const { rows, total, pageSize } = await listCandidates(auth.orgId, { q, page });
  return (
    <>
      <PageHeader title="Candidates" description="Everyone you've added or invited." actions={can(auth.role, "candidate:write") && <Suspense><NewCandidateDialog /></Suspense>} />
      <div className="mb-4"><Suspense><SearchBar placeholder="Search by name, email or skill…" /></Suspense></div>
      {rows.length === 0 ? (
        <EmptyState icon={Users} title={q ? "No matching candidates" : "No candidates yet"} description={q ? "Try another name, email or skill." : "Add a candidate or invite one from a job."} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Candidate</th>
                  <th className="px-4 py-2.5 font-medium">Top skills</th>
                  <th className="px-4 py-2.5 font-medium">Latest interview</th>
                  <th className="px-4 py-2.5 text-right font-medium">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((c) => (
                  <tr key={c.id} className="group relative hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{initials(c.name)}</span>
                        <div className="min-w-0">
                          <Link href={`/candidates/${c.id}`} className="font-medium after:absolute after:inset-0 group-hover:text-primary">{c.name}</Link>
                          <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(c.parsed_profile?.skills ?? []).slice(0, 4).map((s) => <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-xs">{s}</span>)}
                        {!c.parsed_profile && <span className="text-xs text-muted-foreground">{c.resume_file_path ? "Analyzing resume…" : "No resume"}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.latest_status ? <div className="flex flex-col items-start gap-1"><StatusBadge status={c.latest_status} /><span className="text-xs text-muted-foreground">{c.latest_job}</span></div> : <span className="text-xs text-muted-foreground">Not invited</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{timeAgo(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} basePath="/candidates" params={{ q }} />
        </div>
      )}
    </>
  );
}
