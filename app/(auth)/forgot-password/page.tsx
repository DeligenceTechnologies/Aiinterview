import Link from "next/link";
import { ForgotForm } from "@/components/auth/forgot-form";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">We&apos;ll email you a secure reset link.</p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm"><Link href="/login" className="text-muted-foreground hover:text-foreground">Back to sign in</Link></p>
    </>
  );
}
