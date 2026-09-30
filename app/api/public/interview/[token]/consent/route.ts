import { z } from "zod";
import { body, route } from "@/lib/api";
import { giveConsent } from "@/lib/interview/controller";

export const POST = route<{ token: string }>(async (req, { token }) => {
  return giveConsent(token, await body(req, z.object({ consent: z.boolean(), version: z.string().max(40) })));
}, { rateLimit: { key: "pub-consent", limit: 20, windowMs: 60_000 } });
