import { route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { dismissNotifications } from "@/lib/services/workspace";

/** Clear one notification for the current person. */
export const DELETE = route<{ id: string }>(async (_req, { id }) => {
  const auth = await requireApiAuth();
  await dismissNotifications(auth.orgId, auth.userId, uuidParam(id));
  return { ok: true };
});
