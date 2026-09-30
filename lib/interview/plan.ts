import "server-only";
import { json, withOrg } from "@/lib/database/db";
import { audit } from "@/lib/audit";
import { generateInterviewPlan, PLANNER_VERSION } from "@/lib/ai/interview-planner";
import { mockPlan } from "@/lib/ai/mock";
import { log } from "@/lib/logger";
import type { JobRequirements, ResumeProfile } from "@/lib/validation/ai-schemas";
import { StoredPlanSchema, type StoredPlan, type StoredPlanSection } from "@/types/interview";

type SectionRow = {
  id: string;
  sort_order: number;
  name: string;
  objective: string;
  config: {
    instructions: string;
    duration_minutes: number;
    min_questions: number;
    max_questions: number;
    max_followups: number;
    evaluation_criteria: string[];
    scoring_enabled: boolean;
  };
};

/**
 * Build and persist the personalized plan for an interview. The AI proposes
 * questions; this function enforces the template's structure and limits.
 */
export async function buildInterviewPlan(orgId: string, interviewId: string): Promise<StoredPlan> {
  // If the resume was just uploaded, wait briefly for parsing so the plan can be personalized.
  for (let i = 0; i < 30; i++) {
    const [c] = await withOrg(orgId, (tx) => tx<{ parse_status: string | null }[]>`
      select c.parse_status from interviews i join candidates c on c.id = i.candidate_id where i.id = ${interviewId}`);
    if (!c || !["pending", "processing"].includes(c.parse_status ?? "")) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  const ctx = await withOrg(orgId, async (tx) => {
    const [row] = await tx<{ job_title: string; job_description: string; parsed_requirements: JobRequirements | null; parsed_profile: ResumeProfile | null }[]>`
      select j.title as job_title, j.description as job_description, j.parsed_requirements, c.parsed_profile
      from interviews i join jobs j on j.id = i.job_id join candidates c on c.id = i.candidate_id
      where i.id = ${interviewId} and i.organization_id = ${orgId}`;
    const sections = await tx<SectionRow[]>`
      select s.id, s.sort_order, s.name, s.objective, s.config
      from interview_sections s where s.interview_id = ${interviewId} order by s.sort_order`;
    await tx`update interviews set plan_status = 'processing', plan_error = null where id = ${interviewId}`;
    return { row, sections };
  });
  if (!ctx.row) throw new Error("Interview not found");

  const plannerSections = ctx.sections.map((s, i) => ({
    section_index: i,
    name: s.name,
    objective: s.objective,
    instructions: s.config.instructions,
    duration_minutes: s.config.duration_minutes,
    min_questions: s.config.min_questions,
    max_questions: s.config.max_questions,
    evaluation_criteria: s.config.evaluation_criteria,
  }));

  try {
    const { plan: ai, source } = await generateInterviewPlan({
      orgId,
      jobTitle: ctx.row.job_title,
      jobDescription: ctx.row.job_description,
      requirements: ctx.row.parsed_requirements,
      profile: ctx.row.parsed_profile,
      sections: plannerSections,
    });
    const fallback = mockPlan({ jobTitle: ctx.row.job_title, requirements: ctx.row.parsed_requirements, profile: ctx.row.parsed_profile, sections: plannerSections });

    const sections: StoredPlanSection[] = ctx.sections.map((s, i) => {
      const aiSection = ai.sections.find((x) => x.section_index === i) ?? ai.sections[i];
      let questions = (aiSection?.questions ?? []).filter((q) => q.question.trim().length > 5);
      if (!questions.length) questions = fallback.sections[i].questions;
      const max = Math.max(1, s.config.max_questions);
      questions = questions.slice(0, max);
      return {
        index: i,
        section_id: s.id,
        name: s.name,
        objective: s.objective,
        instructions: s.config.instructions,
        duration_minutes: s.config.duration_minutes,
        min_questions: Math.min(s.config.min_questions, questions.length),
        max_questions: max,
        max_followups: s.config.max_followups,
        evaluation_criteria: s.config.evaluation_criteria,
        scoring_enabled: s.config.scoring_enabled,
        questions: questions.map((q, qi) => ({
          key: `s${i}q${qi}`,
          question: q.question.trim(),
          intent: q.intent,
          evaluation_criteria: q.evaluation_criteria.length ? q.evaluation_criteria : s.config.evaluation_criteria,
          followup_topics: q.followup_topics,
        })),
      };
    });

    const plan = StoredPlanSchema.parse({
      version: 1,
      generated_by: source,
      prompt_version: PLANNER_VERSION,
      generated_at: new Date().toISOString(),
      sections,
    });

    await withOrg(orgId, async (tx) => {
      await tx`update interviews set interview_plan = ${json(plan)}, plan_status = 'completed' where id = ${interviewId}`;
      await audit(tx, { orgId, actorType: "system", action: "interview.plan_generated", entityType: "interview", entityId: interviewId, metadata: { source } });
    });
    return plan;
  } catch (err) {
    log.warn("interview.plan_failed", { interviewId, err });
    await withOrg(orgId, (tx) => tx`update interviews set plan_status = 'failed', plan_error = ${"Interview plan generation failed. Retry from the interview page."} where id = ${interviewId}`);
    throw err;
  }
}
