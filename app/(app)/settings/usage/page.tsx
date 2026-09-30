import { FormCard } from "@/components/settings/form-card";
import { requireAuth } from "@/lib/auth/session";
import { getUsage } from "@/lib/services/workspace";

export const metadata = { title: "Usage" };

const FEATURE: Record<string, string> = {
  resume_parser: "Resume parsing", job_parser: "Job parsing", interview_planner: "Interview planning", answer_analyzer: "Answer analysis",
  followup_engine: "Follow-up decisions", section_evaluator: "Section evaluation", report_generator: "Report generation", realtime_session: "Realtime sessions",
};

export default async function UsagePage() {
  const auth = await requireAuth("usage:view");
  const { byFeature, interviews } = await getUsage(auth.orgId);
  const totalTokens = byFeature.reduce((a, f) => a + f.input_tokens + f.output_tokens, 0);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        {[["Interviews completed (30d)", interviews.total], ["Interview minutes (30d)", interviews.minutes], ["AI tokens (30d)", totalTokens.toLocaleString()]].map(([k, v]) => (
          <div key={String(k)} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 text-2xl font-semibold tabular">{v}</p></div>
        ))}
      </div>
      <FormCard title="AI calls by feature" description="Last 30 days. Realtime audio usage is billed by OpenAI per session minute and isn't tokenized here.">
        {byFeature.length === 0 ? <p className="text-sm text-muted-foreground">No AI usage recorded yet.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="pb-2 font-medium">Feature</th><th className="pb-2 text-right font-medium">Calls</th><th className="pb-2 text-right font-medium">Failures</th><th className="pb-2 text-right font-medium">Tokens in / out</th><th className="pb-2 text-right font-medium">Avg latency</th></tr></thead>
            <tbody className="divide-y">
              {byFeature.map((f) => (
                <tr key={f.feature}><td className="py-2">{FEATURE[f.feature] ?? f.feature}</td><td className="py-2 text-right tabular">{f.calls}</td><td className="py-2 text-right tabular">{f.failures}</td><td className="py-2 text-right tabular">{f.input_tokens.toLocaleString()} / {f.output_tokens.toLocaleString()}</td><td className="py-2 text-right tabular">{(f.avg_ms / 1000).toFixed(1)}s</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </FormCard>
    </>
  );
}
