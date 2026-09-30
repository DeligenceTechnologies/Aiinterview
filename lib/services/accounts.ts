import "server-only";
import { json, withOrg, withSystem } from "@/lib/database/db";
import { audit } from "@/lib/audit";
import { ApiError } from "@/lib/api";
import { env } from "@/lib/env";
import { emailTemplates, sendEmail } from "@/lib/email";
import { DEFAULT_TEMPLATES } from "@/lib/interview/default-templates";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { generateToken, hashToken } from "@/lib/security/tokens";
import type { Role } from "@/lib/auth/permissions";
import { OrgSettingsSchema } from "./org-settings";
import { insertTemplate } from "./templates";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "org";
}

export async function signup(input: { name: string; email: string; password: string; orgName?: string; inviteToken?: string }) {
  const passwordHash = await hashPassword(input.password);
  return withSystem(async (tx) => {
    const existing = await tx`select 1 from users where email = ${input.email}`;
    if (existing.length) throw new ApiError(409, "An account with this email already exists. Try signing in.");

    const [user] = await tx<{ id: string }[]>`
      insert into users (email, name, password_hash) values (${input.email}, ${input.name}, ${passwordHash}) returning id`;

    if (input.inviteToken) {
      const [invite] = await tx<{ id: string; organization_id: string; role: Role; email: string }[]>`
        select id, organization_id, role, email from organization_invites
        where token_hash = ${hashToken(input.inviteToken)} and accepted_at is null and expires_at > now()`;
      if (!invite) throw new ApiError(400, "This invitation link is invalid or has expired.");
      if (invite.email.toLowerCase() !== input.email.toLowerCase()) throw new ApiError(400, "Please sign up with the email address the invitation was sent to.");
      await tx`insert into organization_members (organization_id, user_id, role) values (${invite.organization_id}, ${user.id}, ${invite.role})`;
      await tx`update organization_invites set accepted_at = now() where id = ${invite.id}`;
      await audit(tx, { orgId: invite.organization_id, userId: user.id, action: "team.joined", entityType: "user", entityId: user.id, metadata: { role: invite.role } });
      return { userId: user.id, orgId: invite.organization_id };
    }

    const orgName = input.orgName?.trim() || `${input.name.split(" ")[0]}'s Team`;
    const slug = `${slugify(orgName)}-${generateToken(6).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5)}`;
    const [org] = await tx<{ id: string }[]>`
      insert into organizations (name, slug, settings) values (${orgName}, ${slug}, ${json(OrgSettingsSchema.parse({}))}) returning id`;
    await tx`insert into organization_members (organization_id, user_id, role) values (${org.id}, ${user.id}, 'owner')`;
    for (const [i, t] of DEFAULT_TEMPLATES.entries()) await insertTemplate(tx, org.id, user.id, t, i === 0);
    await audit(tx, { orgId: org.id, userId: user.id, action: "auth.signup", entityType: "organization", entityId: org.id });
    return { userId: user.id, orgId: org.id };
  });
}

const DUMMY_HASH = "scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

export async function authenticate(email: string, password: string) {
  const [user] = await withSystem((tx) => tx<{ id: string; password_hash: string }[]>`
    select id, password_hash from users where email = ${email}`);
  // Always run a hash comparison to keep response timing uniform.
  const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw new ApiError(401, "Incorrect email or password.");
  const [m] = await withSystem((tx) => tx<{ organization_id: string }[]>`
    select organization_id from organization_members where user_id = ${user.id} order by created_at limit 1`);
  if (m) await withOrg(m.organization_id, (tx) => audit(tx, { orgId: m.organization_id, userId: user.id, action: "auth.login", entityType: "user", entityId: user.id }));
  return { userId: user.id, orgId: m?.organization_id ?? null };
}

export async function requestPasswordReset(email: string) {
  const [user] = await withSystem((tx) => tx<{ id: string }[]>`select id from users where email = ${email}`);
  if (!user) return; // Do not reveal whether an account exists.
  const token = generateToken();
  await withSystem((tx) => tx`
    insert into password_resets (user_id, token_hash, expires_at) values (${user.id}, ${hashToken(token)}, now() + interval '1 hour')`);
  const tpl = emailTemplates.passwordReset({ link: `${env().APP_URL}/reset-password?token=${token}` });
  await sendEmail({ to: email, subject: tpl.subject, text: tpl.text });
}

export async function resetPassword(token: string, password: string) {
  const passwordHash = await hashPassword(password);
  await withSystem(async (tx) => {
    const [r] = await tx<{ id: string; user_id: string }[]>`
      select id, user_id from password_resets where token_hash = ${hashToken(token)} and used_at is null and expires_at > now()`;
    if (!r) throw new ApiError(400, "This reset link is invalid or has expired.");
    await tx`update users set password_hash = ${passwordHash} where id = ${r.user_id}`;
    await tx`update password_resets set used_at = now() where id = ${r.id}`;
    await tx`delete from sessions where user_id = ${r.user_id}`;
  });
}

export async function inviteMember(auth: { orgId: string; orgName: string; userId: string; name: string }, email: string, role: Role) {
  const token = generateToken();
  await withOrg(auth.orgId, async (tx) => {
    const members = await tx`select 1 from organization_members m join users u on u.id = m.user_id where m.organization_id = ${auth.orgId} and u.email = ${email}`;
    if (members.length) throw new ApiError(409, "This person is already a member.");
    await tx`delete from organization_invites where organization_id = ${auth.orgId} and email = ${email} and accepted_at is null`;
    await tx`insert into organization_invites (organization_id, email, role, token_hash, invited_by, expires_at)
      values (${auth.orgId}, ${email}, ${role}, ${hashToken(token)}, ${auth.userId}, now() + interval '7 days')`;
    await audit(tx, { orgId: auth.orgId, userId: auth.userId, action: "team.invited", entityType: "invite", metadata: { role } });
  });
  const link = `${env().APP_URL}/signup?invite=${token}`;
  const tpl = emailTemplates.teamInvite({ orgName: auth.orgName, inviter: auth.name, role, link });
  await sendEmail({ to: email, subject: tpl.subject, text: tpl.text, orgId: auth.orgId });
  return { link };
}

export async function getInvite(token: string) {
  const [invite] = await withSystem((tx) => tx<{ email: string; org_name: string; role: Role }[]>`
    select i.email, o.name as org_name, i.role from organization_invites i join organizations o on o.id = i.organization_id
    where i.token_hash = ${hashToken(token)} and i.accepted_at is null and i.expires_at > now()`);
  return invite ?? null;
}
