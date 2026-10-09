import { z } from "zod";
import { ApiError, body, route } from "@/lib/api";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/security/tokens";
import { createSession } from "@/lib/auth/session";
import { signup } from "@/lib/services/accounts";

const Schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(10, "Use at least 10 characters").max(200),
  orgName: z.string().trim().max(100).optional(),
  inviteToken: z.string().max(200).optional(),
  accessCode: z.string().max(200).optional(),
});

export const POST = route(async (req) => {
  const input = await body(req, Schema);
  // Sign-up is approval-only: a team invitation, or the access code given to approved customers.
  if (!input.inviteToken) {
    const code = env().SIGNUP_ACCESS_CODE;
    if (!code || !input.accessCode || !safeEqual(input.accessCode.trim(), code)) {
      throw new ApiError(403, "DeliberateHire AI is available by approval. Book a demo or request access to get an access code.");
    }
  }
  const { userId, orgId } = await signup(input);
  await createSession(userId, orgId);
  return { ok: true };
}, { rateLimit: { key: "signup", limit: 10, windowMs: 60 * 60_000 } });
