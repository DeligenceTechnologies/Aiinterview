import { describe, expect, it } from "vitest";
import { advanceState, canTransition, computeAllowed, resolveNextStep, sanitizeSpoken, shouldConsiderFollowup } from "@/lib/interview/state-machine";
import type { AnswerAnalysis } from "@/lib/validation/ai-schemas";
import { initialInterviewState, type InterviewState, type StoredPlan } from "@/types/interview";

const q = (k: string) => ({ key: k, question: `Question ${k}?`, intent: "i", evaluation_criteria: ["c"], followup_topics: ["t"] });
const section = (i: number, over: Partial<StoredPlan["sections"][number]> = {}) => ({
  index: i, section_id: `00000000-0000-4000-8000-00000000000${i}`, name: `S${i}`, objective: "o", instructions: "",
  duration_minutes: 5, min_questions: 1, max_questions: 3, max_followups: 2, evaluation_criteria: ["c"], scoring_enabled: true,
  questions: [q(`s${i}q0`), q(`s${i}q1`), q(`s${i}q2`)], ...over,
});
const plan: StoredPlan = { version: 1, generated_by: "mock", prompt_version: "t", generated_at: "", sections: [section(0), section(1)] };
const state = (over: Partial<InterviewState> = {}): InterviewState => ({ ...initialInterviewState(), phase: "in_progress", section_started_ms: 0, ...over });
const analysis = (over: Partial<AnswerAnalysis> = {}): AnswerAnalysis => ({
  relevance: "high", completeness: "partial", evidence: [], missing_evidence: ["x"], followup_needed: true, candidate_asked_for_clarification: false, summary: "", ...over,
});

describe("computeAllowed", () => {
  it("allows follow-ups within limits and time", () => {
    const a = computeAllowed({ plan, state: state(), nowMs: 60_000 });
    expect(a.follow_up).toBe(true);
    expect(a.fallback).toBe("next_question");
  });

  it("enforces max follow-ups per question", () => {
    const a = computeAllowed({ plan, state: state({ followups_used: 2 }), nowMs: 60_000 });
    expect(a.follow_up).toBe(false);
  });

  it("stops follow-ups near the end of the section budget", () => {
    const a = computeAllowed({ plan, state: state(), nowMs: 5 * 60_000 * 0.9 });
    expect(a.follow_up).toBe(false);
  });

  it("moves to the next section when the section time is up and minimum met", () => {
    const a = computeAllowed({ plan, state: state({ question_index: 0 }), nowMs: 6 * 60_000 });
    expect(a.next_question).toBe(false);
    expect(a.fallback).toBe("next_section");
  });

  it("still asks planned questions until the minimum is met even if over time", () => {
    const p: StoredPlan = { ...plan, sections: [section(0, { min_questions: 2 }), section(1)] };
    const a = computeAllowed({ plan: p, state: state({ question_index: 0 }), nowMs: 6 * 60_000 });
    expect(a.next_question).toBe(true);
  });

  it("respects max_questions", () => {
    const p: StoredPlan = { ...plan, sections: [section(0, { max_questions: 1 }), section(1)] };
    expect(computeAllowed({ plan: p, state: state(), nowMs: 1000 }).next_question).toBe(false);
  });

  it("finishes after the last question of the last section", () => {
    const a = computeAllowed({ plan, state: state({ section_index: 1, question_index: 2 }), nowMs: 1000 });
    expect(a.fallback).toBe("finish");
  });

  it("force-finishes when the whole interview runs far over time", () => {
    const a = computeAllowed({ plan, state: state({ section_started_ms: 13 * 60_000 }), nowMs: 14 * 60_000 });
    expect(a.follow_up).toBe(false);
    expect(a.fallback).toBe("finish");
  });
});

describe("resolveNextStep", () => {
  const allowed = computeAllowed({ plan, state: state(), nowMs: 1000 });

  it("accepts a valid follow-up", () => {
    const r = resolveNextStep(allowed, { action: "follow_up", reason: "gap", missing_evidence: ["x"], question: "What did you own?", transition: "Thanks." });
    expect(r).toMatchObject({ action: "follow_up", followupQuestion: "What did you own?", overridden: false });
  });

  it("rejects a follow-up when not allowed", () => {
    const blocked = computeAllowed({ plan, state: state({ followups_used: 2 }), nowMs: 1000 });
    const r = resolveNextStep(blocked, { action: "follow_up", reason: "gap", missing_evidence: [], question: "Again?", transition: null });
    expect(r.action).toBe("next_question");
    expect(r.overridden).toBe(true);
  });

  it("rejects an empty follow-up question", () => {
    const r = resolveNextStep(allowed, { action: "follow_up", reason: "", missing_evidence: [], question: "  ", transition: null });
    expect(r.action).toBe("next_question");
  });

  it("does not let the AI skip ahead of the plan", () => {
    const r = resolveNextStep(allowed, { action: "finish", reason: "done", missing_evidence: [], question: null, transition: null });
    expect(r.action).toBe("next_question");
    expect(r.overridden).toBe(true);
  });

  it("falls back to the rule default when the AI fails", () => {
    expect(resolveNextStep(allowed, null).action).toBe("next_question");
  });
});

describe("shouldConsiderFollowup", () => {
  const allowed = computeAllowed({ plan, state: state(), nowMs: 1000 });
  it("skips the follow-up engine for sufficient answers", () => {
    expect(shouldConsiderFollowup(allowed, analysis({ followup_needed: false }))).toBe(false);
  });
  it("uses it for clarification requests", () => {
    expect(shouldConsiderFollowup(allowed, analysis({ followup_needed: false, candidate_asked_for_clarification: true }))).toBe(true);
  });
});

describe("advanceState", () => {
  it("increments follow-ups", () => {
    expect(advanceState(plan, state(), "follow_up", 1000).state.followups_used).toBe(1);
  });
  it("resets follow-ups on next question", () => {
    const a = advanceState(plan, state({ followups_used: 2 }), "next_question", 1000);
    expect(a.state).toMatchObject({ question_index: 1, followups_used: 0 });
    expect(a.planned).toEqual({ sectionIndex: 0, questionIndex: 1 });
  });
  it("moves to next section and records completion", () => {
    const a = advanceState(plan, state({ question_index: 2 }), "next_section", 90_000);
    expect(a.state).toMatchObject({ section_index: 1, question_index: 0, section_started_ms: 90_000 });
    expect(a.sectionCompleted).toBe(0);
  });
  it("next_section on the last section finishes", () => {
    const a = advanceState(plan, state({ section_index: 1 }), "next_section", 1000);
    expect(a.finished).toBe(true);
    expect(a.state.phase).toBe("finished");
  });
});

describe("interview status transitions", () => {
  it("allows the normal lifecycle", () => {
    const path = ["created", "invited", "device_check", "ready", "in_progress", "completing", "completed", "processing", "report_ready"];
    for (let i = 1; i < path.length; i++) expect(canTransition(path[i - 1], path[i])).toBe(true);
  });
  it("blocks illegal transitions", () => {
    expect(canTransition("report_ready", "in_progress")).toBe(false);
    expect(canTransition("cancelled", "in_progress")).toBe(false);
  });
});

describe("sanitizeSpoken", () => {
  it("strips markup and trims", () => {
    expect(sanitizeSpoken("  **What** did you _own_?  ")).toBe("What did you own?");
  });
  it("returns null for empty input", () => {
    expect(sanitizeSpoken("")).toBeNull();
  });
});
