import "server-only";
import { aiIsLive } from "@/lib/env";
import { JobRequirementsSchema, type JobRequirements } from "@/lib/validation/ai-schemas";
import * as prompt from "@/prompts/job-parser/v1";
import { AI_CONFIG } from "./config";
import { mockParseJob } from "./mock";
import { runStructured } from "./openai-client";

export async function parseJob(input: {
  orgId: string;
  title: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
}): Promise<JobRequirements> {
  if (!aiIsLive()) {
    return mockParseJob({ title: input.title, description: input.description, required: input.requiredSkills, preferred: input.preferredSkills });
  }
  return runStructured({
    orgId: input.orgId,
    feature: "job_parser",
    model: AI_CONFIG.jobParser,
    promptVersion: prompt.version,
    system: prompt.system,
    user: prompt.buildUser({
      title: input.title,
      description: input.description,
      recruiterSkills: { required: input.requiredSkills, preferred: input.preferredSkills },
    }),
    schema: JobRequirementsSchema,
    schemaName: "job_requirements",
  });
}
