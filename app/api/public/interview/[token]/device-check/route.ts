import { z } from "zod";
import { body, route } from "@/lib/api";
import { completeDeviceCheck } from "@/lib/interview/controller";

export const POST = route<{ token: string }>(async (req, { token }) => {
  return completeDeviceCheck(token, await body(req, z.object({ camera: z.boolean(), microphone: z.boolean(), browser: z.string().max(300) })));
}, { rateLimit: { key: "pub-device", limit: 20, windowMs: 60_000 } });
