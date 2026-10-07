import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/session";
import { getInvite } from "@/lib/services/accounts";
import { SignupForm } from "@/components/auth/signup-form";
import { isWellFormedToken } from "@/lib/security/tokens";
import { DEMO_URL } from "@/lib/marketing";

export const metadata = { title: "Create account" };

export default async function SignupPage(props: PageProps<"/signup">) {
  const sp = await props.searchParams;
  const token = typeof sp.invite === "string" && isWellFormedToken(sp.invite) ? sp.invite : null;
  if (!token && (await getAuth())) redirect("/dashboard");
  const invite = token ? await getInvite(token) : null;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{invite ? `Join ${invite.org_name}` : "Create your workspace"}</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        {invite ? `You've been invited as ${invite.role}.` : "HireLens is available by approval. Enter the access code you received from our team."}
      </p>
      {token && !invite ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">This invitation is invalid or has expired. Ask your admin for a new one.</p>
      ) : (
        <SignupForm invite={invite && token ? { token, email: invite.email, orgName: invite.org_name } : null} />
      )}
      {!token && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          No access code yet? <Link href="/#contact" className="font-medium text-primary hover:underline">Request access</Link> or <a href={DEMO_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">book a demo</a>.
        </p>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
      </p>
    </>
  );
}
