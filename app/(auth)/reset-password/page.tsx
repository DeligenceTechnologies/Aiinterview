import { ResetForm } from "@/components/auth/reset-form";

export const metadata = { title: "Set new password" };

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const { token } = await props.searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">You&apos;ll be signed out of other sessions.</p>
      {typeof token === "string" ? <ResetForm token={token} /> : <p className="text-sm text-destructive">This reset link is missing its token.</p>}
    </>
  );
}
