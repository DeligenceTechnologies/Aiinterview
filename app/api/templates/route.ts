import { body, route } from "@/lib/api";
import { requireApiAuth } from "@/lib/auth/session";
import { createTemplate, listTemplates } from "@/lib/services/templates";
import { TemplateInputSchema } from "@/types/interview";

export const GET = route(async () => {
  const auth = await requireApiAuth();
  return listTemplates(auth.orgId);
});

export const POST = route(async (req) => {
  const auth = await requireApiAuth("template:write");
  return { id: await createTemplate(auth.orgId, auth.userId, await body(req, TemplateInputSchema)) };
});
