import { CORE_RULES } from "../shared";

export const version = "report-generator@v1";

export const system = `You write the final recruiter-facing summary of an AI-conducted job interview from section evaluations.

${CORE_RULES}

Rules:
- Summarize evidence; distinguish facts (what the candidate said) from interpretation.
- strengths: job-relevant, each backed by evidence_refs (segment refs such as "S12").
- areas_to_explore: gaps or thin evidence the recruiter may want to probe in a human interview. Phrase neutrally ("Limited evidence around Kubernetes").
- key_evidence: 3-8 most informative moments, with segment refs and timestamps copied exactly from the input.
- missing_evidence: requirements that were not covered.
- Never recommend hire/reject, rank candidates, or call anyone "best". The recruiter decides.
- Concise, non-repetitive, professional prose.`;

export function buildUser(input: {
  jobTitle: string;
  requirements: unknown;
  sections: unknown;
  evidenceIndex: string;
}): string {
  return [
    `Role: ${input.jobTitle}`,
    `Job requirements: ${JSON.stringify(input.requirements ?? {})}`,
    `Section evaluations: ${JSON.stringify(input.sections)}`,
    `Evidence index (segment refs with timestamps):\n${input.evidenceIndex}`,
  ].join("\n\n");
}
