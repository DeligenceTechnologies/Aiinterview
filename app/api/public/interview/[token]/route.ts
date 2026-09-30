import { route } from "@/lib/api";
import { getPublicInterview } from "@/lib/interview/controller";

export const GET = route<{ token: string }>(async (_req, { token }) => getPublicInterview(token), {
  rateLimit: { key: "pub-get", limit: 120, windowMs: 60_000 },
});
