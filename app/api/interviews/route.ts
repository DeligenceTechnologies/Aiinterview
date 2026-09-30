import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { createInterview, listInterviews } from "@/lib/services/interviews";

export const GET = route(async (req) => {
  const auth = await requireApiAuth("interview:view");
  const sp = req.nextUrl.searchParams;
  return listInterviews(auth.orgId, {
    q: sp.get("q") ?? undefined,
    status: sp.get("status") ?? undefined,
    jobId: sp.get("jobId") ?? undefined,
    page: Number(sp.get("page") ?? 1),
  });
});

const Schema = z.object({
  jobId: z.string().uuid(),
  candidateId: z.string().uuid(),
  templateId: z.string().uuid().nullable().optional(),
  sendInvite: z.boolean().default(true),
});

export const POST = route(async (req) => {
  const auth = await requireApiAuth("interview:write");
  return createInterview(auth.orgId, auth.userId, await body(req, Schema));
}, { rateLimit: { key: "interview-create", limit: 120, windowMs: 60 * 60_000 } });
