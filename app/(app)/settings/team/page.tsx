import { TeamManager } from "@/components/settings/team-manager";
import { assignableRoles, can } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { listMembers } from "@/lib/services/workspace";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const auth = await requireAuth();
  const { members, invites } = await listMembers(auth.orgId);
  return (
    <TeamManager
      me={auth.userId}
      canManage={can(auth.role, "team:manage")}
      assignable={assignableRoles(auth.role)}
      members={members.map((m) => ({ ...m, created_at: m.created_at.toISOString() }))}
      invites={invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expires_at: i.expires_at.toISOString() }))}
    />
  );
}
