import "server-only";
import { aiIsLive } from "@/lib/env";
import { SectionEvaluationSchema, type SectionEvaluation } from "@/lib/validation/ai-schemas";
import * as prompt from "@/prompts/section-evaluator/v1";
import { AI_CONFIG } from "./config";
import { mockEvaluateSection } from "./mock";
import { runStructured } from "./openai-client";

export const EVALUATOR_VERSION = prompt.version;

export type EvalSegment = { ref: string; speaker: string; text: string; start: number; end: number };

export async function evaluateSection(input: {
  orgId: string;
  jobTitle: string;
  sectionName: string;
  objective: string;
  criteria: string[];
  segments: EvalSegment[];
}): Promise<{ evaluation: SectionEvaluation; source: "openai" | "mock" }> {
  const hasCandidateSpeech = input.segments.some((s) => s.speaker === "candidate" && s.text.trim());
  if (!aiIsLive() || !hasCandidateSpeech) return { evaluation: mockEvaluateSection(input.segments), source: "mock" };
  const transcript = input.segments
    .map((s) => `[${s.ref} ${s.start}-${s.end}] ${s.speaker}: ${s.text.replace(/\s+/g, " ")}`)
    .join("\n");
  const evaluation = await runStructured({
    orgId: input.orgId,
    feature: "section_evaluator",
    model: AI_CONFIG.evaluator,
    promptVersion: prompt.version,
    system: prompt.system,
    user: prompt.buildUser({
      sectionName: input.sectionName,
      objective: input.objective,
      criteria: input.criteria,
      jobTitle: input.jobTitle,
      transcript,
    }),
    schema: SectionEvaluationSchema,
    schemaName: "section_evaluation",
  });
  return { evaluation, source: "openai" };
}
