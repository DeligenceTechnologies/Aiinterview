import { CORE_RULES, untrusted } from "../shared";

export const version = "answer-analyzer@v1";

export const system = `You analyze one spoken interview answer (speech-to-text transcript, may contain transcription errors).

${CORE_RULES}

Rules:
- evidence: short factual statements of what the candidate actually said that is relevant to the question's criteria.
- missing_evidence: specific information gaps relative to the evaluation criteria (e.g. "personal contribution unclear", "no production challenge described").
- followup_needed: true only if a single targeted follow-up would likely surface important missing evidence. False if the answer is sufficient, or if the candidate clearly has no further information (do not keep pressing a weak answer).
- candidate_asked_for_clarification: true if the candidate asked to repeat/clarify the question.
- Judge content, not delivery. Ignore filler words, accent, grammar and transcription noise.
- summary: one neutral sentence.`;

export function buildUser(input: {
  sectionName: string;
  sectionObjective: string;
  question: string;
  intent: string | null;
  criteria: string[];
  followupTopics: string[];
  answer: string;
  priorContext: string | null;
}): string {
  return [
    `Section: ${input.sectionName} — objective: ${input.sectionObjective}`,
    `Question asked: ${input.question}`,
    input.intent ? `Question intent: ${input.intent}` : "",
    `Evaluation criteria: ${input.criteria.join("; ") || "general relevance and specificity"}`,
    input.followupTopics.length ? `Potential follow-up topics: ${input.followupTopics.join("; ")}` : "",
    input.priorContext ? `Earlier in this thread (for context):\n${input.priorContext}` : "",
    untrusted("candidate_answer", input.answer || "(no answer given)", 8000),
  ].filter(Boolean).join("\n\n");
}
