import { route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { streamRecording } from "@/lib/interview/recording";

/** Streams a recording to authorized recruiters (session cookie + recording:view). */
export const GET = route<{ recordingId: string }>(async (req, { recordingId }) => {
  const auth = await requireApiAuth("recording:view");
  return streamRecording(auth.orgId, uuidParam(recordingId), req.headers.get("range"));
});
