import { route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { revokeInvite } from "@/lib/services/workspace";

export const DELETE = route<{ inviteId: string }>(async (_req, { inviteId }) => {
  const auth = await requireApiAuth("team:manage");
  await revokeInvite(auth.orgId, uuidParam(inviteId));
  return { ok: true };
});
