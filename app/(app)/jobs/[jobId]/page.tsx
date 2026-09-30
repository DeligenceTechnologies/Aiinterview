import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3, Loader2, MapPin, Sparkles, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AutoRefresh } from "@/components/common/auto-refresh";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/states";
import { InviteDialog } from "@/components/interview/invite-dialog";
import { InterviewTable } from "@/components/interviews/interview-table";
import { JobActions } from "@/components/jobs/job-actions";
import { can } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { employmentTypeLabel, formatDate } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { listInterviews } from "@/lib/services/interviews";
import { getJob } from "@/lib/services/jobs";
import { applyUrl, listApplications } from "@/lib/services/applications";
import { ApplyLinkCard } from "@/components/applications/apply-link-card";
import { ApplicationsTable } from "@/components/applications/applications-table";

export default async function JobPage(props: PageProps<"/jobs/[jobId]">) {
  const auth = await requireAuth();
  const { jobId } = await props.params;
  if (!isUuid(jobId)) notFound();
  const job = await getJob(auth.orgId, jobId);
  if (!job) notFound();
  const [interviews, applications] = await Promise.all([listInterviews(auth.orgId, { jobId }), listApplications(auth.orgId, jobId)]);
  const screening = applications.some((a) => a.screening_status === "pending" || a.screening_status === "processing");
  const newCount = applications.filter((a) => a.status === "new").length;
  const req = job.parsed_requirements;
  const parsing = job.parse_status === "pending" || job.parse_status === "processing";
  return (
    <>
      <AutoRefresh active={parsing || screening} />
      <PageHeader
        back={{ href: "/jobs", label: "Jobs" }}
        title={<span className="flex items-center gap-3">{job.title} <StatusBadge status={job.status} /></span>}
        meta={<>
          {job.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{job.location}</span>}
          {job.employment_type && <span>{employmentTypeLabel[job.employment_type]}</span>}
          {job.experience_min != null && <span>{job.experience_min}{job.experience_max != null ? `–${job.experience_max}` : "+"} years</span>}
          <span>Created {formatDate(job.created_at)}</span>
        </>}
        actions={can(auth.role, "job:write") && <JobActions jobId={job.id} status={job.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold">Applications <span className="ml-1 text-sm font-normal text-muted-foreground">{applications.length}</span>
                {newCount > 0 && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">{newCount} new</span>}
              </h2>
              <span className="text-xs text-muted-foreground">AI tags help prioritise review — they are not decisions.</span>
            </div>
            <ApplicationsTable rows={applications.map((a) => ({ ...a, created_at: a.created_at.toISOString() }))} />
          </section>
          <section className="rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
              <h2 className="font-semibold">Interviews <span className="ml-1 text-sm font-normal text-muted-foreground">{interviews.total}</span></h2>
              <div className="flex gap-2">
                {interviews.total > 1 && <Link href={`/jobs/${job.id}/compare`} className={buttonVariants({ variant: "outline" })}><BarChart3 /> Compare</Link>}
                {can(auth.role, "interview:write") && job.status !== "closed" && <InviteDialog jobId={job.id} />}
              </div>
            </div>
            {interviews.rows.length ? <InterviewTable rows={interviews.rows} hideJob /> : (
              <div className="p-5"><EmptyState icon={Users} title="No candidates invited yet" description="Invite a candidate — upload their resume and the AI will tailor the interview to their experience." /></div>
            )}
            {interviews.total > interviews.rows.length && (
              <div className="border-t px-5 py-3 text-sm"><Link className="text-primary hover:underline" href={`/interviews?jobId=${job.id}`}>View all {interviews.total} interviews</Link></div>
            )}
          </section>
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 font-semibold">Job description</h2>
            {job.description ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{job.description}</p> : <p className="text-sm text-muted-foreground">No description added.</p>}
          </section>
        </div>
        <div className="space-y-6">
          <ApplyLinkCard jobId={job.id} enabled={job.apply_enabled} url={job.apply_slug ? applyUrl(job.apply_slug) : null} jobActive={job.status === "active"} canEdit={can(auth.role, "job:write")} />
          <section className="rounded-xl border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-primary" /> Parsed requirements</h2>
              {parsing && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Analyzing</span>}
            </div>
            {job.parse_status === "failed" && <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{job.parse_error}</p>}
            {req ? (
              <div className="space-y-4 text-sm">
                <p className="text-muted-foreground">{req.summary}</p>
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Required</p>
                  <div className="flex flex-wrap gap-1.5">{req.skills.filter((s) => s.importance === "required").map((s) => <span key={s.name} className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{s.name}</span>)}</div>
                </div>
                {req.skills.some((s) => s.importance === "preferred") && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preferred</p>
                    <div className="flex flex-wrap gap-1.5">{req.skills.filter((s) => s.importance === "preferred").map((s) => <span key={s.name} className="rounded-md bg-muted px-2 py-0.5 text-xs">{s.name}</span>)}</div>
                  </div>
                )}
                {req.experience.minimum_years != null && <p><span className="text-muted-foreground">Experience:</span> {req.experience.minimum_years}+ years</p>}
                {req.seniority !== "unknown" && <p><span className="text-muted-foreground">Seniority:</span> <span className="capitalize">{req.seniority}</span></p>}
                {req.responsibilities.length > 0 && (
                  <ul className="list-disc space-y-1 pl-4 text-muted-foreground">{req.responsibilities.slice(0, 6).map((r) => <li key={r}>{r}</li>)}</ul>
                )}
              </div>
            ) : !parsing && <p className="text-sm text-muted-foreground">Add a job description to extract structured requirements.</p>}
          </section>
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-2 font-semibold">Interview template</h2>
            {job.interview_template_id ? (
              <Link href={`/templates/${job.interview_template_id}`} className="text-sm text-primary hover:underline">{job.template_name}</Link>
            ) : <p className="text-sm text-muted-foreground">No template selected — the workspace default will be used.</p>}
          </section>
        </div>
      </div>
    </>
  );
}
