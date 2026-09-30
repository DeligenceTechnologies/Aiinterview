import { route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { getTranscript } from "@/lib/services/interviews";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const auth = await requireApiAuth("interview:view");
  return { segments: await getTranscript(auth.orgId, uuidParam(id)) };
});
