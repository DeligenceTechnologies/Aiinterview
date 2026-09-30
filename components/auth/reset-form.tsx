"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthForm } from "./auth-form";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  return (
    <AuthForm
      endpoint="/api/auth/reset-password"
      submitLabel="Set new password"
      fields={[{ name: "password", label: "New password", type: "password", autoComplete: "new-password", hint: "At least 10 characters." }]}
      extra={{ token }}
      onSuccess={() => {
        toast.success("Password updated. Please sign in.");
        router.push("/login");
      }}
    />
  );
}
