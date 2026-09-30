import { ProfileForm } from "@/components/settings/profile-form";
import { requireAuth } from "@/lib/auth/session";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const auth = await requireAuth();
  return <ProfileForm name={auth.name} email={auth.email} />;
}
