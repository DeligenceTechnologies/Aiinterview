import { route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { parseCandidateResume } from "@/lib/services/candidates";

export const POST = route<{ id: string }>(async (_req, { id }) => {
  const auth = await requireApiAuth("candidate:write");
  return { profile: await parseCandidateResume(auth.orgId, uuidParam(id)) };
}, { rateLimit: { key: "resume-parse", limit: 30, windowMs: 60 * 60_000 } });
