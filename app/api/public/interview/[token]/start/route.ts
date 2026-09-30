import { route } from "@/lib/api";
import { startInterview } from "@/lib/interview/controller";

export const POST = route<{ token: string }>(async (_req, { token }) => startInterview(token), {
  rateLimit: { key: "pub-start", limit: 20, windowMs: 60_000 },
});
