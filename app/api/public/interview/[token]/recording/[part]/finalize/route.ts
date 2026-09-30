import { z } from "zod";
import { ApiError, body, route } from "@/lib/api";
import { finalizeRecordingPart } from "@/lib/interview/recording";

export const POST = route<{ token: string; part: string }>(async (req, { token, part }) => {
  const p = Number(part);
  if (!Number.isInteger(p) || p < 0) throw new ApiError(400, "Invalid part");
  const input = await body(req, z.object({ duration_ms: z.number().min(0).nullable(), total_chunks: z.number().int().min(0) }));
  return finalizeRecordingPart(token, p, input);
}, { rateLimit: { key: "pub-rec-final", limit: 30, windowMs: 60_000 } });
