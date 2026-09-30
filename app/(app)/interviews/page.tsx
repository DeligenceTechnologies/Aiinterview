import { Suspense } from "react";
import { Video } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { SearchBar } from "@/components/common/search-bar";
import { EmptyState } from "@/components/common/states";
import { InterviewTable } from "@/components/interviews/interview-table";
import { requireAuth } from "@/lib/auth/session";
import { listInterviews } from "@/lib/services/interviews";
import { listJobs } from "@/lib/services/jobs";

export const metadata = { title: "Interviews" };

export default async function InterviewsPage(props: PageProps<"/interviews">) {
  const auth = await requireAuth("interview:view");
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const page = Number(str("page") ?? 1) || 1;
  const filters = { q: str("q"), status: str("status"), jobId: str("jobId"), from: str("from"), to: str("to") };
  const [data, jobs] = await Promise.all([
    listInterviews(auth.orgId, { ...filters, jobId: filters.jobId && /^[0-9a-f-]{36}$/i.test(filters.jobId) ? filters.jobId : undefined, page }),
    listJobs(auth.orgId),
  ]);
  const filtered = Object.values(filters).some(Boolean);
  return (
    <>
      <PageHeader title="Interviews" description="Every AI interview across your jobs." />
      <div className="mb-4">
        <Suspense>
          <SearchBar placeholder="Search candidate, email or job…" filters={[
            { name: "status", label: "All statuses", options: [{ value: "pending", label: "Not started" }, { value: "in_progress", label: "In progress" }, { value: "completed", label: "Completed" }, { value: "closed", label: "Cancelled / expired" }] },
            { name: "jobId", label: "All jobs", options: jobs.map((j) => ({ value: j.id, label: j.title })) },
          ]} />
        </Suspense>
      </div>
      {data.rows.length === 0 ? (
        <EmptyState icon={Video} title={filtered ? "No matching interviews" : "No interviews yet"} description={filtered ? "Try adjusting your filters." : "Invite a candidate from a job page to start."} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <InterviewTable rows={data.rows} />
          <Pagination page={page} pageSize={data.pageSize} total={data.total} basePath="/interviews" params={filters} />
        </div>
      )}
    </>
  );
}
