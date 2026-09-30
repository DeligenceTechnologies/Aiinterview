import { z } from "zod";
import { body, route, uuidParam } from "@/lib/api";
import { ROLES } from "@/lib/auth/permissions";
import { requireApiAuth } from "@/lib/auth/session";
import { changeMemberRole, removeMember } from "@/lib/services/workspace";

export const PATCH = route<{ memberId: string }>(async (req, { memberId }) => {
  const auth = await requireApiAuth("team:manage");
  const { role } = await body(req, z.object({ role: z.enum(ROLES) }));
  await changeMemberRole(auth, uuidParam(memberId), role);
  return { ok: true };
});

export const DELETE = route<{ memberId: string }>(async (_req, { memberId }) => {
  const auth = await requireApiAuth("team:manage");
  await removeMember(auth, uuidParam(memberId));
  return { ok: true };
});
