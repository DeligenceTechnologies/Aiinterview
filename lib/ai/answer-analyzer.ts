import "server-only";
import { aiIsLive } from "@/lib/env";
import { log } from "@/lib/logger";
import { AnswerAnalysisSchema, type AnswerAnalysis } from "@/lib/validation/ai-schemas";
import * as prompt from "@/prompts/answer-analyzer/v1";
import { AI_CONFIG } from "./config";
import { mockAnalyzeAnswer } from "./mock";
import { runStructured } from "./openai-client";

export const ANALYZER_VERSION = prompt.version;

/** Never throws: interview flow must continue even if analysis fails. */
export async function analyzeAnswer(input: { orgId: string } & Parameters<typeof prompt.buildUser>[0]): Promise<AnswerAnalysis & { source: string }> {
  if (!aiIsLive()) return { ...mockAnalyzeAnswer(input.answer), source: "mock" };
  try {
    const { orgId, ...rest } = input;
    const analysis = await runStructured({
      orgId,
      feature: "answer_analyzer",
      model: AI_CONFIG.answerAnalyzer,
      promptVersion: prompt.version,
      system: prompt.system,
      user: prompt.buildUser(rest),
      schema: AnswerAnalysisSchema,
      schemaName: "answer_analysis",
    });
    return { ...analysis, source: "openai" };
  } catch (err) {
    log.warn("ai.answer_analysis_fallback", { err });
    return { ...mockAnalyzeAnswer(input.answer), followup_needed: false, source: "fallback" };
  }
}
