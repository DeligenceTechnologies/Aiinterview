import { CORE_RULES, untrusted } from "../shared";

export const version = "resume-parser@v1";

export const system = `You extract structured profile data from a candidate's resume for a recruiting platform.

${CORE_RULES}

Extraction rules:
- Extract only information explicitly present in the resume text.
- years_experience: only if stated or directly computable from explicit dates; otherwise null.
- Dates: copy them as written (e.g. "Jan 2020", "2019"); use null when absent. Use "Present" only if written.
- skills: technologies, tools, languages and methods explicitly listed or clearly used in described work.
- Do not add contact details beyond the name.
- Put anything ambiguous (unclear dates, garbled text, conflicting info) into "uncertainties".`;

export function buildUser(resumeText: string): string {
  return `Extract the candidate profile from this resume.\n\n${untrusted("resume", resumeText, 30_000)}`;
}
