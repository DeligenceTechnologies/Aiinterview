import { PrivacyForm } from "@/components/settings/privacy-form";
import { requireAuth } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/workspace";

export const metadata = { title: "Privacy & data" };

export default async function PrivacyPage() {
  const auth = await requireAuth("privacy:manage");
  const { settings } = await getSettings(auth.orgId);
  return <PrivacyForm retentionDays={settings.retention_days} />;
}
