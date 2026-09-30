import { z } from "zod";
import { body, route } from "@/lib/api";
import { logEvents } from "@/lib/interview/controller";

const Schema = z.object({
  events: z.array(z.object({
    event_id: z.string().min(1).max(120),
    type: z.string().min(1).max(60),
    payload: z.record(z.string(), z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).optional(),
  })).max(50),
});

export const POST = route<{ token: string }>(async (req, { token }) => {
  await logEvents(token, (await body(req, Schema)).events);
  return { ok: true };
}, { rateLimit: { key: "pub-events", limit: 120, windowMs: 60_000 } });
