import { describe, expect, it } from "vitest";
import { reconcileMatch } from "@/lib/ai/application-screener";
import { ApplyInputSchema } from "@/lib/services/applications";
import type { ApplicationScreening } from "@/lib/validation/ai-schemas";

const req = (status: "met" | "partially_met" | "not_evident", importance: "required" | "preferred" = "required") =>
  ({ requirement: "x", importance, status, evidence: null });
const screening = (match_level: ApplicationScreening["match_level"], requirements: ApplicationScreening["requirements"]): ApplicationScreening => ({
  match_level, summary: "", requirements, strengths: [], gaps: [], experience_evidence: null, suggested_interview_focus: [],
});

describe("reconcileMatch", () => {
  it("keeps a strong match that the evidence supports", () => {
    const r = reconcileMatch(screening("strong_match", [req("met"), req("met"), req("met"), req("met"), req("partially_met")]));
    expect(r).toEqual({ level: "strong_match", met: 4, total: 5 });
  });
  it("caps an over-optimistic AI tag at what the requirements show", () => {
    expect(reconcileMatch(screening("strong_match", [req("met"), req("not_evident"), req("not_evident")])).level).toBe("partial_match");
    expect(reconcileMatch(screening("good_match", [req("not_evident"), req("not_evident"), req("not_evident"), req("partially_met")])).level).toBe("low_match");
  });
  it("never raises the AI's tag", () => {
    expect(reconcileMatch(screening("low_match", [req("met"), req("met")])).level).toBe("low_match");
  });
  it("only scores required items when there are any", () => {
    const r = reconcileMatch(screening("good_match", [req("met"), req("met"), req("not_evident", "preferred")]));
    expect(r).toMatchObject({ met: 2, total: 2, level: "good_match" });
  });
  it("passes through insufficient information", () => {
    expect(reconcileMatch(screening("insufficient_information", [req("met")])).level).toBe("insufficient_information");
  });
});

describe("ApplyInputSchema", () => {
  const base = { name: "Sam", email: "SAM@Example.com", consent: true as const };
  it("normalizes email and optional fields", () => {
    const v = ApplyInputSchema.parse({ ...base, phone: "", linkedin_url: "" });
    expect(v).toMatchObject({ email: "sam@example.com", phone: null, linkedin_url: null });
  });
  it("requires consent", () => {
    expect(ApplyInputSchema.safeParse({ ...base, consent: false }).success).toBe(false);
  });
  it("rejects non-http profile links", () => {
    expect(ApplyInputSchema.safeParse({ ...base, linkedin_url: "javascript:alert(1)" }).success).toBe(false);
  });
});
