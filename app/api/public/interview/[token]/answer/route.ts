import { z } from "zod";
import { body, route } from "@/lib/api";
import { submitAnswer } from "@/lib/interview/controller";

const Schema = z.object({
  question_id: z.string().uuid(),
  text: z.string().max(20_000),
  start_ms: z.number().int().min(0).nullable(),
  end_ms: z.number().int().min(0).nullable(),
});

export const POST = route<{ token: string }>(async (req, { token }) => submitAnswer(token, await body(req, Schema)), {
  rateLimit: { key: "pub-answer", limit: 40, windowMs: 60_000 },
});
