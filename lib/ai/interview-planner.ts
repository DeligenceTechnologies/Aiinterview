import "server-only";
import { aiIsLive } from "@/lib/env";
import { InterviewPlanSchema, type InterviewPlanAI, type JobRequirements, type ResumeProfile } from "@/lib/validation/ai-schemas";
import * as prompt from "@/prompts/interview-planner/v1";
import { AI_CONFIG } from "./config";
import { mockPlan } from "./mock";
import { runStructured } from "./openai-client";

export const PLANNER_VERSION = prompt.version;

export async function generateInterviewPlan(input: {
  orgId: string;
  jobTitle: string;
  jobDescription: string;
  requirements: JobRequirements | null;
  profile: ResumeProfile | null;
  sections: prompt.PlannerSectionInput[];
}): Promise<{ plan: InterviewPlanAI; source: "openai" | "mock" }> {
  if (!aiIsLive()) {
    return {
      plan: mockPlan({ jobTitle: input.jobTitle, requirements: input.requirements, profile: input.profile, sections: input.sections }),
      source: "mock",
    };
  }
  const plan = await runStructured({
    orgId: input.orgId,
    feature: "interview_planner",
    model: AI_CONFIG.interviewPlanner,
    reasoningEffort: AI_CONFIG.plannerReasoningEffort,
    promptVersion: prompt.version,
    system: prompt.system,
    user: prompt.buildUser({
      jobTitle: input.jobTitle,
      jobRequirements: input.requirements,
      jobDescription: input.jobDescription,
      candidateProfile: input.profile,
      sections: input.sections,
    }),
    schema: InterviewPlanSchema,
    schemaName: "interview_plan",
  });
  return { plan, source: "openai" };
}
