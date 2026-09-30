import { z } from "zod";
import { ApiError, body, route } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { withSystem } from "@/lib/database/db";
import { hashPassword, verifyPassword } from "@/lib/security/password";

const Schema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().min(10, "Use at least 10 characters").max(200).optional(),
});

export const PATCH = route(async (req) => {
  const auth = await requireApiAuth();
  const input = await body(req, Schema);
  if (input.newPassword) {
    const [u] = await withSystem((tx) => tx<{ password_hash: string }[]>`select password_hash from users where id = ${auth.userId}`);
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, u.password_hash))) throw new ApiError(400, "Current password is incorrect.");
    const hash = await hashPassword(input.newPassword);
    await withSystem((tx) => tx`update users set password_hash = ${hash} where id = ${auth.userId}`);
    await withSystem((tx) => tx`delete from sessions where user_id = ${auth.userId} and id <> ${auth.sessionId}`);
  }
  if (input.name) await withSystem((tx) => tx`update users set name = ${input.name!} where id = ${auth.userId}`);
  return { ok: true };
}, { rateLimit: { key: "profile", limit: 20, windowMs: 15 * 60_000 } });
