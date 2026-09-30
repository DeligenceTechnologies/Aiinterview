import { PageHeader } from "@/components/common/page-header";
import { JobForm } from "@/components/jobs/job-form";
import { requireAuth } from "@/lib/auth/session";
import { listTemplates } from "@/lib/services/templates";

export const metadata = { title: "New job" };

export default async function NewJobPage() {
  const auth = await requireAuth("job:write");
  const templates = await listTemplates(auth.orgId);
  return (
    <>
      <PageHeader title="Create job" back={{ href: "/jobs", label: "Jobs" }} />
      <JobForm templates={templates} />
    </>
  );
}
