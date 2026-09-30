import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { JobForm } from "@/components/jobs/job-form";
import { requireAuth } from "@/lib/auth/session";
import { getJob } from "@/lib/services/jobs";
import { listTemplates } from "@/lib/services/templates";

export const metadata = { title: "Edit job" };

export default async function EditJobPage(props: PageProps<"/jobs/[jobId]/edit">) {
  const auth = await requireAuth("job:write");
  const { jobId } = await props.params;
  const [job, templates] = await Promise.all([getJob(auth.orgId, jobId).catch(() => null), listTemplates(auth.orgId)]);
  if (!job) notFound();
  return (
    <>
      <PageHeader title={`Edit ${job.title}`} back={{ href: `/jobs/${job.id}`, label: job.title }} />
      <JobForm jobId={job.id} templates={templates} initial={{
        title: job.title, description: job.description, location: job.location, employment_type: job.employment_type,
        experience_min: job.experience_min, experience_max: job.experience_max, required_skills: job.required_skills,
        preferred_skills: job.preferred_skills, responsibilities: job.responsibilities, interview_template_id: job.interview_template_id, status: job.status,
      }} />
    </>
  );
}
