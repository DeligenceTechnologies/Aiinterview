import "server-only";
import { aiIsLive } from "@/lib/env";
import { log } from "@/lib/logger";
import { FollowupDecisionSchema, type AnswerAnalysis, type FollowupDecision } from "@/lib/validation/ai-schemas";
import * as prompt from "@/prompts/followup-engine/v1";
import { AI_CONFIG } from "./config";
import { mockFollowup } from "./mock";
import { runStructured } from "./openai-client";

/**
 * Suggest a follow-up. Returns null on failure so the state machine applies
 * its rule-based default instead of stalling the interview.
 */
export async function suggestFollowup(input: {
  orgId: string;
  question: string;
  answer: string;
  analysis: AnswerAnalysis;
  followupTopics: string[];
  alreadyAsked: string[];
  followupsUsed: number;
  followupsRemaining: number;
  sectionSecondsRemaining: number;
}): Promise<FollowupDecision | null> {
  if (!aiIsLive()) {
    return mockFollowup({ question: input.question, followupsUsed: input.followupsUsed, clarification: input.analysis.candidate_asked_for_clarification });
  }
  try {
    return await runStructured({
      orgId: input.orgId,
      feature: "followup_engine",
      model: AI_CONFIG.followupEngine,
      promptVersion: prompt.version,
      system: prompt.system,
      user: prompt.buildUser({
        question: input.question,
        answer: input.answer,
        analysis: input.analysis,
        followupTopics: input.followupTopics,
        alreadyAsked: input.alreadyAsked,
        followupsRemaining: input.followupsRemaining,
        sectionSecondsRemaining: input.sectionSecondsRemaining,
      }),
      schema: FollowupDecisionSchema,
      schemaName: "followup_decision",
    });
  } catch (err) {
    log.warn("ai.followup_fallback", { err });
    return null;
  }
}
