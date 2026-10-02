import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { env } from "@/lib/env";
import { withOrg } from "@/lib/database/db";
import { log } from "@/lib/logger";
import { AI_CONFIG, type AIFeature } from "./config";

let client: OpenAI | null = null;

export function openai(): OpenAI {
  const key = env().OPENAI_API_KEY;
  if (!key) throw new AIError("not_configured", "OpenAI API key is not configured");
  if (!client) client = new OpenAI({ apiKey: key, timeout: AI_CONFIG.timeoutMs, maxRetries: 1 });
  return client;
}

export class AIError extends Error {
  constructor(public code: "not_configured" | "invalid_output" | "request_failed" | "refused", message: string) {
    super(message);
    this.name = "AIError";
  }
}

export async function recordUsage(entry: {
  orgId: string;
  feature: AIFeature;
  model: string;
  promptVersion?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
  success: boolean;
  errorCode?: string;
}) {
  try {
    await withOrg(entry.orgId, (tx) => tx`
      insert into ai_usage (organization_id, feature, model, prompt_version, input_tokens, output_tokens, duration_ms, success, error_code)
      values (${entry.orgId}, ${entry.feature}, ${entry.model}, ${entry.promptVersion ?? null}, ${entry.inputTokens ?? 0},
              ${entry.outputTokens ?? 0}, ${entry.durationMs}, ${entry.success}, ${entry.errorCode ?? null})`);
  } catch (err) {
    log.warn("ai.usage_record_failed", { err });
  }
}

/**
 * Call a text model and return output validated against `schema`.
 * Retries on transport errors and on schema-invalid output; throws AIError
 * after the final attempt so callers can fall back safely.
 */
export async function runStructured<S extends z.ZodType>(opts: {
  orgId: string;
  feature: AIFeature;
  model: string;
  promptVersion: string;
  system: string;
  user: string;
  schema: S;
  schemaName: string;
  /** Optional latency tuning; omitted means model defaults. */
  reasoningEffort?: "none" | "low" | "medium" | "high";
  verbosity?: "low" | "medium" | "high";
  maxAttempts?: number;
  timeoutMs?: number;
}): Promise<z.infer<S>> {
  const api = openai();
  let lastErr: unknown;
  const maxAttempts = opts.maxAttempts ?? AI_CONFIG.maxAttempts;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const started = Date.now();
    try {
      const res = await api.responses.parse({
        model: opts.model,
        input: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        text: { format: zodTextFormat(opts.schema, opts.schemaName), ...(opts.verbosity ? { verbosity: opts.verbosity } : {}) },
        ...(opts.reasoningEffort ? { reasoning: { effort: opts.reasoningEffort } } : {}),
      } as Parameters<typeof api.responses.parse>[0], opts.timeoutMs ? { timeout: opts.timeoutMs, maxRetries: 0 } : undefined);
      const durationMs = Date.now() - started;
      const parsed = opts.schema.safeParse(res.output_parsed);
      await recordUsage({
        orgId: opts.orgId,
        feature: opts.feature,
        model: opts.model,
        promptVersion: opts.promptVersion,
        inputTokens: res.usage?.input_tokens,
        outputTokens: res.usage?.output_tokens,
        durationMs,
        success: parsed.success,
        errorCode: parsed.success ? undefined : "invalid_output",
      });
      if (parsed.success) {
        log.info("ai.call_succeeded", { feature: opts.feature, model: opts.model, attempt, durationMs });
        return parsed.data;
      }
      lastErr = new AIError("invalid_output", "Model output failed validation");
      log.warn("ai.invalid_output", { feature: opts.feature, attempt, issues: parsed.error.issues.slice(0, 3).map((i) => i.path.join(".")) });
    } catch (err) {
      lastErr = err;
      const status = err instanceof OpenAI.APIError ? err.status : undefined;
      await recordUsage({
        orgId: opts.orgId,
        feature: opts.feature,
        model: opts.model,
        promptVersion: opts.promptVersion,
        durationMs: Date.now() - started,
        success: false,
        errorCode: status ? `http_${status}` : "request_failed",
      });
      log.warn("ai.call_failed", { feature: opts.feature, model: opts.model, attempt, status, message: err instanceof Error ? err.message : String(err) });
      // Auth / bad request errors will not succeed on retry.
      if (status && [400, 401, 403, 404].includes(status)) break;
    }
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 500 * attempt));
  }
  if (lastErr instanceof AIError) throw lastErr;
  throw new AIError("request_failed", lastErr instanceof Error ? lastErr.message : "AI request failed");
}
