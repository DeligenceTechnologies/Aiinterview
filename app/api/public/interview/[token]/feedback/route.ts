import { body, route } from "@/lib/api";
import { CandidateFeedbackSchema } from "@/lib/feedback";
import { submitCandidateFeedback } from "@/lib/services/feedback";

export const POST = route<{ token: string }>(async (req, { token }) => {
  return submitCandidateFeedback(token, await body(req, CandidateFeedbackSchema));
}, { rateLimit: { key: "pub-feedback", limit: 10, windowMs: 60_000 } });
