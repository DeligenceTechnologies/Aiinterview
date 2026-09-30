import { z } from "zod";
import { body, route } from "@/lib/api";
import { requestPasswordReset } from "@/lib/services/accounts";

export const POST = route(async (req) => {
  const { email } = await body(req, z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email") }));
  await requestPasswordReset(email);
  return { ok: true };
}, { rateLimit: { key: "forgot", limit: 5, windowMs: 15 * 60_000 } });
