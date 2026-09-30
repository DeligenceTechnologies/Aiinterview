import "server-only";
import { after } from "next/server";
import { log } from "@/lib/logger";

/**
 * Run long work after the response is sent (Next.js `after`). Falls back to a
 * detached promise outside a request scope (scripts, tests). Work must be
 * idempotent and record its own status so it can be retried.
 */
export function runInBackground(name: string, fn: () => Promise<unknown>) {
  const task = async () => {
    const started = Date.now();
    try {
      await fn();
      log.info("background.done", { name, ms: Date.now() - started });
    } catch (err) {
      log.error("background.failed", { name, err });
    }
  };
  try {
    after(task);
  } catch {
    void task();
  }
}
