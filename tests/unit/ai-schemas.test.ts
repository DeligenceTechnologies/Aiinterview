import { describe, expect, it } from "vitest";
import { mockAnalyzeAnswer, mockEvaluateSection, mockParseJob, mockParseResume, mockPlan, mockReport } from "@/lib/ai/mock";
import { AnswerAnalysisSchema, FinalReportSchema, FollowupDecisionSchema, InterviewPlanSchema, JobRequirementsSchema, ResumeProfileSchema, SectionEvaluationSchema } from "@/lib/validation/ai-schemas";
import { InterviewStateSchema, TemplateInputSchema } from "@/types/interview";
import { DEFAULT_TEMPLATES } from "@/lib/interview/default-templates";

describe("AI output validation", () => {
  it("rejects malformed follow-up decisions", () => {
    expect(FollowupDecisionSchema.safeParse({ action: "hire", reason: "", missing_evidence: [], question: null, transition: null }).success).toBe(false);
    expect(FollowupDecisionSchema.safeParse({ action: "follow_up", reason: "x" }).success).toBe(false);
  });
  it("rejects hiring-decision style assessments", () => {
    expect(SectionEvaluationSchema.safeParse({ assessment: "hire", summary: "", strengths: [], concerns: [], criteria: [], evidence: [] }).success).toBe(false);
  });
  it("final report has no hire/reject field", () => {
    expect(Object.keys(FinalReportSchema.shape)).not.toContain("recommendation");
  });
});

describe("demo-mode AI produces schema-valid output and never invents facts", () => {
  const resume = "Sam Rivera\nBackend Engineer\n6 years experience with Python, Django and PostgreSQL at Initech.\nB.S. Computer Science, State University";
  it("resume", () => {
    const p = mockParseResume(resume);
    expect(ResumeProfileSchema.parse(p)).toBeTruthy();
    expect(p.skills).toEqual(expect.arrayContaining(["Python", "Django", "PostgreSQL"]));
    expect(p.skills).not.toContain("React");
    expect(p.years_experience).toBe(6);
  });
  it("job", () => {
    expect(JobRequirementsSchema.parse(mockParseJob({ title: "Senior Engineer", description: "5+ years React", required: ["React"], preferred: [] }))).toBeTruthy();
  });
  it("plan respects section bounds", () => {
    const plan = mockPlan({ jobTitle: "Eng", requirements: null, profile: null, sections: [{ section_index: 0, name: "Project Deep Dive", objective: "o", instructions: "", duration_minutes: 5, min_questions: 1, max_questions: 2, evaluation_criteria: [] }] });
    expect(InterviewPlanSchema.parse(plan).sections[0].questions.length).toBeLessThanOrEqual(2);
  });
  it("answer analysis", () => {
    expect(AnswerAnalysisSchema.parse(mockAnalyzeAnswer("")).completeness).toBe("no_answer");
    expect(mockAnalyzeAnswer("could you repeat the question").candidate_asked_for_clarification).toBe(true);
  });
  it("evaluation and report", () => {
    const ev = mockEvaluateSection([{ ref: "S1", speaker: "candidate", text: "word ".repeat(60), start: 0, end: 1000 }]);
    expect(SectionEvaluationSchema.parse(ev).evidence[0].segment_ref).toBe("S1");
    expect(FinalReportSchema.parse(mockReport([{ name: "A", assessment: ev.assessment, evidence: ev.evidence }]))).toBeTruthy();
  });
});

describe("templates & state", () => {
  it("default templates are valid", () => {
    for (const t of DEFAULT_TEMPLATES) expect(TemplateInputSchema.safeParse(t).success).toBe(true);
  });
  it("rejects min > max questions", () => {
    const bad = { ...DEFAULT_TEMPLATES[0], sections: [{ ...DEFAULT_TEMPLATES[0].sections[0], min_questions: 5, max_questions: 2 }] };
    expect(TemplateInputSchema.safeParse(bad).success).toBe(false);
  });
  it("state schema rejects corrupt state", () => {
    expect(InterviewStateSchema.safeParse({ phase: "weird" }).success).toBe(false);
  });
});
