import { route } from "@/lib/api";
import { getSessionState } from "@/lib/interview/controller";

export const GET = route<{ token: string }>(async (_req, { token }) => getSessionState(token), {
  rateLimit: { key: "pub-state", limit: 120, windowMs: 60_000 },
});
