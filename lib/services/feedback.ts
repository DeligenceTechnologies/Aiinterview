import "server-only";
import { ApiError } from "@/lib/api";
import { audit, notify } from "@/lib/audit";
import { withOrg } from "@/lib/database/db";
import { resolveToken } from "@/lib/interview/controller";
import { ISSUE_CATEGORIES, type CandidateFeedbackInput } from "@/lib/feedback";

const FINISHED = ["completing", "completed", "processing", "report_ready"];
/** Per-interview cap so a link can't be used to flood the team. */
const MAX_PER_INTERVIEW = 10;

export type InterviewFeedbackRow = {
  id: string;
  kind: "feedback" | "issue";
  rating: number | null;
  category: string | null;
  message: string | null;
  created_at: Date;
};

/** Candidate submits feedback or reports an issue after finishing their interview. */
export async function submitCandidateFeedback(token: string, input: CandidateFeedbackInput) {
  const ctx = await resolveToken(token);
  if (!FINISHED.includes(ctx.status)) throw new ApiError(409, "Feedback can be shared once the interview is complete.");
  await withOrg(ctx.orgId, async (tx) => {
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from interview_feedback where interview_id = ${ctx.id}`;
    if (n >= MAX_PER_INTERVIEW) throw new ApiError(429, "Thanks, we've already received your messages for this interview.");
    const message = input.message || null;
    await tx`
      insert into interview_feedback (organization_id, interview_id, kind, rating, category, message)
      values (${ctx.orgId}, ${ctx.id}, ${input.kind}, ${input.kind === "feedback" ? input.rating : null},
              ${input.kind === "issue" ? input.category : null}, ${message})`;
    if (input.kind === "issue") {
      await audit(tx, { orgId: ctx.orgId, actorType: "candidate", action: "interview.issue_reported", entityType: "interview", entityId: ctx.id, metadata: { category: input.category } });
      await notify(tx, {
        orgId: ctx.orgId,
        type: "interview.issue_reported",
        payload: { interview_id: ctx.id, candidate: ctx.candidateName, job: ctx.jobTitle, category: ISSUE_CATEGORIES[input.category] },
      });
    } else {
      await audit(tx, { orgId: ctx.orgId, actorType: "candidate", action: "interview.feedback_submitted", entityType: "interview", entityId: ctx.id, metadata: { rating: input.rating } });
    }
  });
  return { ok: true };
}

export async function listInterviewFeedback(orgId: string, interviewId: string) {
  return withOrg(orgId, (tx) => tx<InterviewFeedbackRow[]>`
    select id, kind, rating, category, message, created_at from interview_feedback
    where interview_id = ${interviewId} order by created_at`);
}
