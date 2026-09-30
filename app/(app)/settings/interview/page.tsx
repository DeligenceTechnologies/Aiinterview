import { OrgSettingsForm } from "@/components/settings/org-settings-form";
import { AI_CONFIG } from "@/lib/ai/config";
import { can } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { aiIsLive } from "@/lib/env";
import { getSettings } from "@/lib/services/workspace";

export const metadata = { title: "Interview settings" };

export default async function InterviewSettingsPage() {
  const auth = await requireAuth();
  const { name, settings } = await getSettings(auth.orgId);
  const models = {
    "Resume parser": AI_CONFIG.resumeParser, "Job parser": AI_CONFIG.jobParser, "Interview planner": AI_CONFIG.interviewPlanner,
    "Answer analyzer": AI_CONFIG.answerAnalyzer, "Follow-up engine": AI_CONFIG.followupEngine, "Evaluator": AI_CONFIG.evaluator,
    "Report generator": AI_CONFIG.reportGenerator, "Realtime voice": AI_CONFIG.realtime, "Transcription": AI_CONFIG.transcription, "Voice": AI_CONFIG.voice,
  };
  return <OrgSettingsForm orgName={name} settings={settings} canEdit={can(auth.role, "org:manage")} ai={{ live: aiIsLive(), models }} />;
}
