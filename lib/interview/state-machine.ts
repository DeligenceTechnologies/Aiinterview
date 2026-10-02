// Pure, deterministic interview flow rules. The LLM may *suggest* a follow-up
// but only this module decides what happens next. No I/O here, so it is
// fully unit-testable.

import type { FollowupDecision } from "@/lib/validation/ai-schemas";
import type { InterviewState, StoredPlan } from "@/types/interview";

export type NextAction = "follow_up" | "next_question" | "next_section" | "finish";

export type FlowContext = {
  plan: StoredPlan;
  state: InterviewState;
  /** Current position on the interview clock (ms since interview start). */
  nowMs: number;
};

export type Allowed = {
  follow_up: boolean;
  next_question: boolean;
  next_section: boolean;
  finish: true;
  /** The action taken if no follow-up is chosen. */
  fallback: Exclude<NextAction, "follow_up">;
  sectionElapsedMs: number;
  sectionLimitMs: number;
  totalElapsedMs: number;
  totalLimitMs: number;
};

/** Fraction of the section budget after which new follow-ups stop. */
const FOLLOWUP_TIME_CUTOFF = 0.85;
/** Interview is force-finished once this multiple of the planned total is used. */
const TOTAL_HARD_LIMIT_FACTOR = 1.3;

export function totalPlannedMs(plan: StoredPlan): number {
  return plan.sections.reduce((acc, s) => acc + s.duration_minutes * 60_000, 0);
}

export function computeAllowed({ plan, state, nowMs }: FlowContext): Allowed {
  const section = plan.sections[state.section_index];
  if (!section) throw new Error(`Invalid section index ${state.section_index}`);

  const sectionLimitMs = section.duration_minutes * 60_000;
  const sectionElapsedMs = Math.max(0, nowMs - (state.section_started_ms ?? nowMs));
  const totalLimitMs = totalPlannedMs(plan);
  const totalElapsedMs = Math.max(0, nowMs);

  const plannedAsked = state.question_index + 1;
  const hasMorePlanned = state.question_index + 1 < section.questions.length;
  const underMax = plannedAsked < section.max_questions;
  const sectionTimeUp = sectionElapsedMs >= sectionLimitMs;
  const belowMin = plannedAsked < section.min_questions;
  const totalTimeUp = totalElapsedMs >= totalLimitMs * TOTAL_HARD_LIMIT_FACTOR;
  const hasNextSection = state.section_index + 1 < plan.sections.length;

  const follow_up =
    !totalTimeUp &&
    state.followups_used < section.max_followups &&
    sectionElapsedMs < sectionLimitMs * FOLLOWUP_TIME_CUTOFF;

  const next_question = !totalTimeUp && hasMorePlanned && underMax && (!sectionTimeUp || belowMin);
  const next_section = !totalTimeUp && hasNextSection;

  const fallback: Allowed["fallback"] = next_question ? "next_question" : next_section ? "next_section" : "finish";

  return {
    follow_up,
    next_question,
    next_section,
    finish: true,
    fallback,
    sectionElapsedMs,
    sectionLimitMs,
    totalElapsedMs,
    totalLimitMs,
  };
}

export type ResolvedStep = {
  action: NextAction;
  followupQuestion: string | null;
  transition: string | null;
  reason: string;
  overridden: boolean;
};

/**
 * Validate an AI follow-up decision against the rules. The AI can only ever
 * pick among allowed actions; anything else falls back to the rule default.
 */
export function resolveNextStep(allowed: Allowed, decision: FollowupDecision | null): ResolvedStep {
  if (!decision) {
    return { action: allowed.fallback, followupQuestion: null, transition: null, reason: "rule_default", overridden: false };
  }
  const transition = sanitizeSpoken(decision.transition);
  if (decision.action === "follow_up") {
    const q = sanitizeSpoken(decision.question);
    if (allowed.follow_up && q) {
      return { action: "follow_up", followupQuestion: q, transition, reason: decision.reason, overridden: false };
    }
    return { action: allowed.fallback, followupQuestion: null, transition, reason: "followup_not_allowed", overridden: true };
  }
  // The AI may not skip ahead of the plan (e.g. jump sections early); the
  // rules decide the non-follow-up path.
  const overridden = decision.action !== allowed.fallback;
  return { action: allowed.fallback, followupQuestion: null, transition, reason: decision.reason, overridden };
}

export type Advance = {
  state: InterviewState;
  /** Planned question to ask next, if any. */
  planned: { sectionIndex: number; questionIndex: number } | null;
  sectionCompleted: number | null;
  finished: boolean;
};

/** Apply a resolved step to the state (the question row id is filled in later). */
export function advanceState(plan: StoredPlan, state: InterviewState, action: NextAction, nowMs: number): Advance {
  const base: InterviewState = { ...state, current_question_id: null, pending_utterance: null };
  switch (action) {
    case "follow_up":
      return {
        state: { ...base, followups_used: state.followups_used + 1 },
        planned: null,
        sectionCompleted: null,
        finished: false,
      };
    case "next_question":
      return {
        state: { ...base, question_index: state.question_index + 1, followups_used: 0 },
        planned: { sectionIndex: state.section_index, questionIndex: state.question_index + 1 },
        sectionCompleted: null,
        finished: false,
      };
    case "next_section": {
      if (state.section_index + 1 >= plan.sections.length) {
        return advanceState(plan, state, "finish", nowMs);
      }
      return {
        state: {
          ...base,
          section_index: state.section_index + 1,
          question_index: 0,
          followups_used: 0,
          section_started_ms: nowMs,
        },
        planned: { sectionIndex: state.section_index + 1, questionIndex: 0 },
        sectionCompleted: state.section_index,
        finished: false,
      };
    }
    case "finish":
      return {
        state: { ...base, phase: "finished" },
        planned: null,
        sectionCompleted: state.section_index,
        finished: true,
      };
  }
}

/** Strip anything that should never be spoken verbatim (markup, overly long text). */
export function sanitizeSpoken(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = text.replace(/[`*_#<>]/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > 400 ? cleaned.slice(0, 400).replace(/\s+\S*$/, "") + "?" : cleaned;
}

const INTERVIEW_STATUS_TRANSITIONS: Record<string, string[]> = {
  // A link can be shared manually without the invitation email, so a candidate
  // may start from "created" as well as "invited".
  created: ["invited", "consent_pending", "device_check", "ready", "in_progress", "cancelled", "expired"],
  invited: ["consent_pending", "device_check", "ready", "in_progress", "cancelled", "expired"],
  consent_pending: ["device_check", "ready", "in_progress", "cancelled", "expired"],
  device_check: ["ready", "in_progress", "cancelled", "expired"],
  ready: ["in_progress", "cancelled", "expired"],
  in_progress: ["completing", "completed", "failed", "cancelled"],
  completing: ["completed", "failed"],
  completed: ["processing", "report_ready", "failed"],
  processing: ["report_ready", "failed", "completed"],
  report_ready: ["processing"],
  failed: ["processing", "completed"],
  cancelled: [],
  expired: ["invited"],
};

export function canTransition(from: string, to: string): boolean {
  if (from === to) return true;
  return INTERVIEW_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: string, to: string) {
  if (!canTransition(from, to)) throw new Error(`Illegal interview status transition ${from} -> ${to}`);
}

/** Remove a leading "thanks/thank you" (the client already said one). */
export function stripThanks(text: string | null): string | null {
  if (!text) return null;
  const rest = text.replace(/^\s*(thanks|thank you)( (so|very) much)?( for (that|sharing( that)?|your answer))?[.,!]?\s*/i, "").trim();
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : null;
}
