import { z } from "zod";

// Shared by the candidate thank-you page and the server.
export const ISSUE_CATEGORIES = {
  audio_video: "Audio or video problem",
  ai_interviewer: "The AI interviewer",
  unclear_questions: "Questions were unclear",
  technical: "Technical error",
  other: "Something else",
} as const;
export type IssueCategory = keyof typeof ISSUE_CATEGORIES;

export const CandidateFeedbackSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("feedback"),
    rating: z.number().int().min(1).max(5),
    message: z.string().trim().max(2000).optional(),
  }),
  z.object({
    kind: z.literal("issue"),
    category: z.enum(Object.keys(ISSUE_CATEGORIES) as [IssueCategory, ...IssueCategory[]]),
    message: z.string().trim().min(5, "Please describe what happened.").max(2000),
  }),
]);
export type CandidateFeedbackInput = z.infer<typeof CandidateFeedbackSchema>;
