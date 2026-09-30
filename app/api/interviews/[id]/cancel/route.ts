import { route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { cancelInterview } from "@/lib/services/interviews";

export const POST = route<{ id: string }>(async (_req, { id }) => {
  const auth = await requireApiAuth("interview:write");
  await cancelInterview(auth.orgId, auth.userId, uuidParam(id));
  return { ok: true };
});
