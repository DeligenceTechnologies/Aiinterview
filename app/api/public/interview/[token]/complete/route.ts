import { z } from "zod";
import { body, route } from "@/lib/api";
import { completeInterview } from "@/lib/interview/controller";

export const POST = route<{ token: string }>(async (req, { token }) => {
  const { reason } = await body(req, z.object({ reason: z.enum(["finished", "candidate_ended", "time_limit"]) }));
  return completeInterview(token, { reason });
}, { rateLimit: { key: "pub-complete", limit: 20, windowMs: 60_000 } });
