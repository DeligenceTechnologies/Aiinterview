import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/session";
import { getInvite } from "@/lib/services/accounts";
import { SignupForm } from "@/components/auth/signup-form";
import { isWellFormedToken } from "@/lib/security/tokens";

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
        {invite ? `You've been invited as ${invite.role}.` : "Start running structured AI interviews in minutes."}
      </p>
      {token && !invite ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">This invitation is invalid or has expired. Ask your admin for a new one.</p>
      ) : (
        <SignupForm invite={invite && token ? { token, email: invite.email, orgName: invite.org_name } : null} />
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
      </p>
    </>
  );
}
