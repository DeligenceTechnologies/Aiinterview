import { route } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { runRetention } from "@/lib/services/workspace";

export const POST = route(async () => {
  const auth = await requireApiAuth("privacy:manage");
  return runRetention(auth.orgId, auth.userId);
});
