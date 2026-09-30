import { z } from "zod";
import { ApiError, body, route } from "@/lib/api";
import { assignableRoles, ROLES } from "@/lib/auth/permissions";
import { requireApiAuth } from "@/lib/auth/session";
import { inviteMember } from "@/lib/services/accounts";
import { listMembers } from "@/lib/services/workspace";

export const GET = route(async () => {
  const auth = await requireApiAuth();
  return listMembers(auth.orgId);
});

export const POST = route(async (req) => {
  const auth = await requireApiAuth("team:manage");
  const { email, role } = await body(req, z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(ROLES) }));
  if (!assignableRoles(auth.role).includes(role)) throw new ApiError(403, "You can't invite someone with that role.");
  return inviteMember(auth, email, role);
}, { rateLimit: { key: "team-invite", limit: 30, windowMs: 60 * 60_000 } });
