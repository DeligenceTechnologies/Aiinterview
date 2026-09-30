import { route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { regeneratePlan } from "@/lib/services/interviews";

export const POST = route<{ id: string }>(async (_req, { id }) => {
  const auth = await requireApiAuth("interview:write");
  return { plan: await regeneratePlan(auth.orgId, uuidParam(id)) };
}, { rateLimit: { key: "plan", limit: 30, windowMs: 60 * 60_000 } });
