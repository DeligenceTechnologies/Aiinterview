import { z } from "zod";
import { body, route } from "@/lib/api";
import { withSystem } from "@/lib/database/db";
import { log } from "@/lib/logger";

const Schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Please enter a valid work email"),
  company: z.string().trim().min(1, "Please enter your company").max(160),
  team_size: z.enum(["1-10", "11-50", "51-200", "201-1000", "1000+"]).nullable().optional(),
  phone: z.string().trim().max(40).optional().transform((v) => v || null),
  message: z.string().trim().max(2000).optional().transform((v) => v || null),
  website: z.string().max(200).optional(), // honeypot
});

/** Public "request access" form. Stored only; reviewed in the database. */
export const POST = route(async (req) => {
  const input = await body(req, Schema);
  if (input.website) return { ok: true }; // bot filled the hidden field: pretend success
  await withSystem((tx) => tx`
    insert into access_requests (name, email, company, team_size, phone, message)
    values (${input.name}, ${input.email}, ${input.company}, ${input.team_size ?? null}, ${input.phone}, ${input.message})`);
  log.info("access_request.received", { email_domain: input.email.split("@")[1] });
  return { ok: true };
}, { rateLimit: { key: "access-request", limit: 5, windowMs: 60 * 60_000 } });
