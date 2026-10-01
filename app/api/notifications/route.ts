import { route } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { dismissNotifications, listNotifications, markNotificationsRead } from "@/lib/services/workspace";

export const GET = route(async () => {
  const auth = await requireApiAuth();
  return { notifications: await listNotifications(auth.orgId, auth.userId) };
});

/** Mark all as read (for the current person). */
export const POST = route(async () => {
  const auth = await requireApiAuth();
  await markNotificationsRead(auth.orgId, auth.userId);
  return { ok: true };
});

/** Clear all notifications for the current person. */
export const DELETE = route(async () => {
  const auth = await requireApiAuth();
  await dismissNotifications(auth.orgId, auth.userId, null);
  return { ok: true };
});
