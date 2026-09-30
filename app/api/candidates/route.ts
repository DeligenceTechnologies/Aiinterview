import { body, route } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { CandidateInputSchema, createCandidate, listCandidates } from "@/lib/services/candidates";

export const GET = route(async (req) => {
  const auth = await requireApiAuth();
  const sp = req.nextUrl.searchParams;
  return listCandidates(auth.orgId, { q: sp.get("q") ?? undefined, jobId: sp.get("jobId") ?? undefined, page: Number(sp.get("page") ?? 1) });
});

export const POST = route(async (req) => {
  const auth = await requireApiAuth("candidate:write");
  return { id: await createCandidate(auth.orgId, auth.userId, await body(req, CandidateInputSchema)) };
});
