import { z } from "zod";
import { body, route } from "@/lib/api";
import { resetPassword } from "@/lib/services/accounts";

export const POST = route(async (req) => {
  const { token, password } = await body(req, z.object({ token: z.string().min(20).max(200), password: z.string().min(10, "Use at least 10 characters").max(200) }));
  await resetPassword(token, password);
  return { ok: true };
}, { rateLimit: { key: "reset", limit: 10, windowMs: 15 * 60_000 } });
