import { route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { screenApplication } from "@/lib/services/applications";

/** Re-run AI screening (e.g. after the job description changed). */
export const POST = route<{ id: string }>(async (_req, { id }) => {
  const auth = await requireApiAuth("candidate:write");
  await screenApplication(auth.orgId, uuidParam(id));
  return { ok: true };
}, { rateLimit: { key: "app-screen", limit: 60, windowMs: 60 * 60_000 } });
