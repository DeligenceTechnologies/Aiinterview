import { z } from "zod";
import { body, route } from "@/lib/api";
import { addTranscriptSegments } from "@/lib/interview/controller";

const Schema = z.object({
  segments: z.array(z.object({
    client_event_id: z.string().min(1).max(120),
    speaker: z.enum(["interviewer", "candidate"]),
    text: z.string().max(10_000),
    start_ms: z.number().min(0),
    end_ms: z.number().min(0),
    question_id: z.string().uuid().nullable(),
  })).max(50),
});

export const POST = route<{ token: string }>(async (req, { token }) => {
  const { segments } = await body(req, Schema);
  return addTranscriptSegments(token, segments);
}, { rateLimit: { key: "pub-transcript", limit: 240, windowMs: 60_000 } });
