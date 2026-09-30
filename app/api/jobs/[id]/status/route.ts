import { z } from "zod";
import { body, route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { setJobStatus } from "@/lib/services/jobs";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const auth = await requireApiAuth("job:write");
  const { status } = await body(req, z.object({ status: z.enum(["draft", "active", "paused", "closed"]) }));
  await setJobStatus(auth.orgId, auth.userId, uuidParam(id), status);
  return { ok: true };
});
