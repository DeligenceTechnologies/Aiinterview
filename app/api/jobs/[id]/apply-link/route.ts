import { z } from "zod";
import { body, route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { setApplyLink } from "@/lib/services/applications";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const auth = await requireApiAuth("job:write");
  const { enabled } = await body(req, z.object({ enabled: z.boolean() }));
  return setApplyLink(auth.orgId, auth.userId, uuidParam(id), enabled);
});
