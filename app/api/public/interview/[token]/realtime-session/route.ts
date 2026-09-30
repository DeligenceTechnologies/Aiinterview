import { route } from "@/lib/api";
import { getRealtimeCredentials } from "@/lib/interview/controller";

/** Mints a short-lived realtime client secret. The OpenAI API key never leaves the server. */
export const POST = route<{ token: string }>(async (_req, { token }) => getRealtimeCredentials(token), {
  rateLimit: { key: "pub-rt", limit: 15, windowMs: 60_000 },
});
