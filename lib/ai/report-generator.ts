import "server-only";
import { aiIsLive } from "@/lib/env";
import { FinalReportSchema, type Assessment, type FinalReport, type SectionEvaluation } from "@/lib/validation/ai-schemas";
import * as prompt from "@/prompts/report-generator/v1";
import { AI_CONFIG } from "./config";
import { mockReport } from "./mock";
import { runStructured } from "./openai-client";

export const REPORT_VERSION = prompt.version;

export async function generateReport(input: {
  orgId: string;
  jobTitle: string;
  requirements: unknown;
  sections: { name: string; objective: string; assessment: Assessment; summary: string; strengths: string[]; concerns: string[]; evidence: SectionEvaluation["evidence"] }[];
}): Promise<{ report: FinalReport; source: "openai" | "mock" }> {
  if (!aiIsLive()) return { report: mockReport(input.sections), source: "mock" };
  const evidenceIndex = input.sections
    .flatMap((s) => s.evidence.map((e) => `${e.segment_ref ?? "-"} [${e.timestamp_start_ms}-${e.timestamp_end_ms}] (${s.name}) ${e.quote_or_paraphrase}`))
    .join("\n");
  const report = await runStructured({
    orgId: input.orgId,
    feature: "report_generator",
    model: AI_CONFIG.reportGenerator,
    promptVersion: prompt.version,
    system: prompt.system,
    user: prompt.buildUser({
      jobTitle: input.jobTitle,
      requirements: input.requirements,
      sections: input.sections.map(({ evidence: _e, ...rest }) => rest),
      evidenceIndex,
    }),
    schema: FinalReportSchema,
    schemaName: "final_report",
  });
  return { report, source: "openai" };
}
