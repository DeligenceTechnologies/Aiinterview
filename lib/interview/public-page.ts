import "server-only";
import { ApiError } from "@/lib/api";
import { getPublicInterview } from "./controller";

export type PublicInterview = Awaited<ReturnType<typeof getPublicInterview>>;

export async function loadPublicInterview(token: string): Promise<{ data: PublicInterview; error: null } | { data: null; error: string }> {
  try {
    return { data: await getPublicInterview(token), error: null };
  } catch (err) {
    if (err instanceof ApiError) return { data: null, error: err.message };
    throw err;
  }
}

const FINISHED = ["completed", "processing", "report_ready", "completing"];

/** Where a candidate should be, given interview state. */
export function candidateStep(d: PublicInterview): "welcome" | "consent" | "device-check" | "session" | "completed" {
  if (FINISHED.includes(d.status)) return "completed";
  if (d.status === "in_progress") return "session";
  if (!d.consent_given) return "welcome";
  return "device-check";
}
