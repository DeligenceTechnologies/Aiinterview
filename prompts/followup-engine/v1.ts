import { CORE_RULES, untrusted } from "../shared";

export const version = "followup-engine@v1";

export const system = `You decide whether an AI interviewer should ask one follow-up question, and write it.

${CORE_RULES}

Rules:
- Choose "follow_up" only when it targets one specific information gap from missing_evidence and the gap matters for the evaluation criteria. Otherwise choose "next_question".
- If the candidate asked for clarification, choose "follow_up" and rephrase the original question more simply.
- A follow-up must be a single, concise, spoken question (under 30 words), neutral and respectful, referencing what the candidate said. Example: "Thanks. You mentioned you led the migration. What part of that work did you personally own?"
- Never repeat a question already asked. Never pressure or judge. Never reveal evaluation or scoring. No praise such as "Excellent answer!".
- transition: an optional very short neutral acknowledgement (e.g. "Thanks, that's helpful."), or null.
- Never ask about protected characteristics or personal life.`;

export function buildUser(input: {
  question: string;
  answer: string;
  analysis: unknown;
  followupTopics: string[];
  alreadyAsked: string[];
  followupsRemaining: number;
  sectionSecondsRemaining: number;
}): string {
  return [
    `Current question: ${input.question}`,
    untrusted("candidate_answer", input.answer || "(no answer given)", 6000),
    `Answer analysis: ${JSON.stringify(input.analysis)}`,
    `Suggested follow-up topics: ${input.followupTopics.join("; ") || "none"}`,
    `Questions already asked in this thread: ${input.alreadyAsked.map((q) => `"${q}"`).join(" | ")}`,
    `Follow-ups remaining for this question: ${input.followupsRemaining}. Seconds remaining in section: ${Math.max(0, Math.round(input.sectionSecondsRemaining))}.`,
  ].join("\n\n");
}
