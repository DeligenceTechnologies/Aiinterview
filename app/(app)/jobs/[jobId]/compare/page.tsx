import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { CompareTable } from "@/components/jobs/compare-table";
import { requireAuth } from "@/lib/auth/session";
import { isUuid } from "@/lib/ids";
import { getJob } from "@/lib/services/jobs";
import { getComparison, getSettings } from "@/lib/services/workspace";

export const metadata = { title: "Compare candidates" };

export default async function ComparePage(props: PageProps<"/jobs/[jobId]/compare">) {
  const auth = await requireAuth("report:view");
  const { jobId } = await props.params;
  if (!isUuid(jobId)) notFound();
  const job = await getJob(auth.orgId, jobId);
  if (!job) notFound();
  const [data, { settings }] = await Promise.all([getComparison(auth.orgId, jobId), getSettings(auth.orgId)]);
  return (
    <>
      <PageHeader back={{ href: `/jobs/${jobId}`, label: job.title }} title="Compare candidates"
        description="Section assessments side by side. These are evidence summaries, not rankings — open each report to review the evidence before deciding." />
      <CompareTable columns={data.columns} rows={data.rows.map((r) => ({ ...r, completed_at: r.completed_at?.toISOString() ?? null }))} showScores={settings.show_scores} />
    </>
  );
}
