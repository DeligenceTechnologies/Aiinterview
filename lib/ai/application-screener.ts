import "server-only";
import { aiIsLive } from "@/lib/env";
import { ApplicationScreeningSchema, type ApplicationScreening, type JobRequirements, type MatchLevel, type ResumeProfile } from "@/lib/validation/ai-schemas";
import * as prompt from "@/prompts/application-screener/v1";
import { AI_CONFIG } from "./config";
import { runStructured } from "./openai-client";

export const SCREENER_VERSION = prompt.version;

export async function screenApplicationAI(input: {
  orgId: string;
  jobTitle: string;
  jobDescription: string;
  requirements: JobRequirements | null;
  profile: ResumeProfile | null;
  resumeText: string;
  coverNote: string | null;
}): Promise<{ screening: ApplicationScreening; source: "openai" | "mock" }> {
  if (!aiIsLive()) return { screening: mockScreen(input.requirements, input.profile), source: "mock" };
  const screening = await runStructured({
    orgId: input.orgId,
    feature: "application_screener",
    model: AI_CONFIG.applicationScreener,
    promptVersion: prompt.version,
    system: prompt.system,
    user: prompt.buildUser({
      jobTitle: input.jobTitle,
      requirements: input.requirements,
      jobDescription: input.jobDescription,
      profile: input.profile,
      resumeText: input.resumeText,
      coverNote: input.coverNote,
    }),
    schema: ApplicationScreeningSchema,
    schemaName: "application_screening",
  });
  return { screening, source: "openai" };
}

/** Demo-mode screening: exact skill overlap only. */
function mockScreen(req: JobRequirements | null, profile: ResumeProfile | null): ApplicationScreening {
  const skills = new Set((profile?.skills ?? []).map((s) => s.toLowerCase()));
  const requirements = (req?.skills ?? []).map((s) => {
    const met = skills.has(s.name.toLowerCase());
    return { requirement: s.name, importance: s.importance, status: met ? ("met" as const) : ("not_evident" as const), evidence: met ? `Listed in resume skills` : null };
  });
  return {
    match_level: "partial_match",
    summary: "Demo-mode screening based on exact skill overlap only (no OpenAI key configured). Review the resume directly.",
    requirements,
    strengths: requirements.filter((r) => r.status === "met").map((r) => `${r.requirement} listed on resume`),
    gaps: requirements.filter((r) => r.status === "not_evident" && r.importance === "required").map((r) => `${r.requirement} not evident in resume`),
    experience_evidence: profile?.years_experience != null ? `${profile.years_experience} years stated` : null,
    suggested_interview_focus: requirements.filter((r) => r.importance === "required").slice(0, 3).map((r) => r.requirement),
  };
}

const RANK: MatchLevel[] = ["insufficient_information", "low_match", "partial_match", "good_match", "strong_match"];

/**
 * The application — not the model — has the final say on the tag: it is
 * derived from the requirement-level evidence and the AI's level is capped
 * so it can never exceed what the evidence supports.
 */
export function reconcileMatch(s: ApplicationScreening): { level: MatchLevel; met: number; total: number } {
  const required = s.requirements.filter((r) => r.importance === "required");
  const scored = required.length ? required : s.requirements;
  const total = scored.length;
  const met = scored.filter((r) => r.status === "met").length;
  const partial = scored.filter((r) => r.status === "partially_met").length;
  // No requirement list to check against (or too little to judge): keep the model's level.
  if (s.match_level === "insufficient_information" || total === 0) return { level: s.match_level, met, total };
  const coverage = (met + partial * 0.5) / total;
  const ceiling: MatchLevel = coverage >= 0.8 ? "strong_match" : coverage >= 0.6 ? "good_match" : coverage >= 0.3 ? "partial_match" : "low_match";
  const level = RANK.indexOf(s.match_level) > RANK.indexOf(ceiling) ? ceiling : s.match_level;
  return { level, met, total };
}
