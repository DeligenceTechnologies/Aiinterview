"use client";

import { useState } from "react";
import { AuthForm } from "./auth-form";

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  if (sent) return <p className="rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">If an account exists for that email, a reset link is on its way. It expires in 1 hour.</p>;
  return <AuthForm endpoint="/api/auth/forgot-password" submitLabel="Send reset link" fields={[{ name: "email", label: "Work email", type: "email", autoComplete: "email" }]} onSuccess={() => setSent(true)} />;
}
