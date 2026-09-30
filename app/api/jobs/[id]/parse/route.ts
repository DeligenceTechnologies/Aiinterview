import { route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { parseJobRequirements } from "@/lib/services/jobs";

export const POST = route<{ id: string }>(async (_req, { id }) => {
  const auth = await requireApiAuth("job:write");
  return { requirements: await parseJobRequirements(auth.orgId, uuidParam(id), auth.userId) };
}, { rateLimit: { key: "job-parse", limit: 30, windowMs: 60 * 60_000 } });
