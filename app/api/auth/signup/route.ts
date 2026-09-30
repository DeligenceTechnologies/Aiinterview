import { z } from "zod";
import { body, route } from "@/lib/api";
import { createSession } from "@/lib/auth/session";
import { signup } from "@/lib/services/accounts";

const Schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(10, "Use at least 10 characters").max(200),
  orgName: z.string().trim().max(100).optional(),
  inviteToken: z.string().max(200).optional(),
});

export const POST = route(async (req) => {
  const input = await body(req, Schema);
  const { userId, orgId } = await signup(input);
  await createSession(userId, orgId);
  return { ok: true };
}, { rateLimit: { key: "signup", limit: 10, windowMs: 60 * 60_000 } });
