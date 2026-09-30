import "server-only";
import { aiIsLive } from "@/lib/env";
import { ResumeProfileSchema, type ResumeProfile } from "@/lib/validation/ai-schemas";
import * as prompt from "@/prompts/resume-parser/v1";
import { AI_CONFIG } from "./config";
import { mockParseResume } from "./mock";
import { runStructured } from "./openai-client";

export async function parseResume(input: { orgId: string; resumeText: string }): Promise<{ profile: ResumeProfile; source: "openai" | "mock" }> {
  if (!aiIsLive()) return { profile: mockParseResume(input.resumeText), source: "mock" };
  const profile = await runStructured({
    orgId: input.orgId,
    feature: "resume_parser",
    model: AI_CONFIG.resumeParser,
    promptVersion: prompt.version,
    system: prompt.system,
    user: prompt.buildUser(input.resumeText),
    schema: ResumeProfileSchema,
    schemaName: "resume_profile",
  });
  return { profile, source: "openai" };
}
