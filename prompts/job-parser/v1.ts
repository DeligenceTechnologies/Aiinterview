import { CORE_RULES, untrusted } from "../shared";

export const version = "job-parser@v1";

export const system = `You convert a job description into structured hiring requirements.

${CORE_RULES}

Rules:
- skills: each distinct skill/technology. "required" when the posting marks it as required/must-have or core to the role; "preferred" for nice-to-have/bonus/plus.
- experience.minimum_years / maximum_years: only if stated; otherwise null.
- responsibilities: concise bullet phrases taken from the description.
- seniority: infer only from explicit title/level wording; otherwise "unknown".
- summary: 1-2 neutral sentences describing the role.`;

export function buildUser(input: { title: string; description: string; recruiterSkills: { required: string[]; preferred: string[] } }): string {
  return [
    `Job title: ${input.title}`,
    input.recruiterSkills.required.length ? `Recruiter-specified required skills: ${input.recruiterSkills.required.join(", ")}` : "",
    input.recruiterSkills.preferred.length ? `Recruiter-specified preferred skills: ${input.recruiterSkills.preferred.join(", ")}` : "",
    untrusted("job_description", input.description, 20_000),
  ].filter(Boolean).join("\n\n");
}
