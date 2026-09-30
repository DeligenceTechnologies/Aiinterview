import { route } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { listNotifications, markNotificationsRead } from "@/lib/services/workspace";

export const GET = route(async () => {
  const auth = await requireApiAuth();
  return { notifications: await listNotifications(auth.orgId, auth.userId) };
});

export const POST = route(async () => {
  const auth = await requireApiAuth();
  await markNotificationsRead(auth.orgId, auth.userId);
  return { ok: true };
});
