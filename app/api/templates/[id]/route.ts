import { ApiError, body, route, uuidParam } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { deleteTemplate, getTemplate, updateTemplate } from "@/lib/services/templates";
import { TemplateInputSchema } from "@/types/interview";

export const GET = route<{ id: string }>(async (_req, { id }) => {
  const auth = await requireApiAuth();
  const t = await getTemplate(auth.orgId, uuidParam(id));
  if (!t) throw new ApiError(404, "Template not found");
  return t;
});

export const PUT = route<{ id: string }>(async (req, { id }) => {
  const auth = await requireApiAuth("template:write");
  await updateTemplate(auth.orgId, auth.userId, uuidParam(id), await body(req, TemplateInputSchema));
  return { ok: true };
});

export const DELETE = route<{ id: string }>(async (_req, { id }) => {
  const auth = await requireApiAuth("template:write");
  await deleteTemplate(auth.orgId, auth.userId, uuidParam(id));
  return { ok: true };
});
