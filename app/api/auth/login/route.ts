import { z } from "zod";
import { body, route } from "@/lib/api";
import { createSession } from "@/lib/auth/session";
import { authenticate } from "@/lib/services/accounts";

const Schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required").max(200),
});

export const POST = route(async (req) => {
  const { email, password } = await body(req, Schema);
  const { userId, orgId } = await authenticate(email, password);
  await createSession(userId, orgId);
  return { ok: true };
}, { rateLimit: { key: "login", limit: 10, windowMs: 10 * 60_000 } });
