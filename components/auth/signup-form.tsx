"use client";

import { useRouter } from "next/navigation";
import { AuthForm, type Field } from "./auth-form";

export function SignupForm({ invite }: { invite: { token: string; email: string; orgName: string } | null }) {
  const router = useRouter();
  const fields: Field[] = [
    { name: "name", label: "Full name", autoComplete: "name" },
    { name: "email", label: "Work email", type: "email", autoComplete: "email", defaultValue: invite?.email, readOnly: !!invite },
    ...(!invite ? [
      { name: "orgName", label: "Company / workspace name", autoComplete: "organization", placeholder: "Acme Inc." },
      { name: "accessCode", label: "Access code", autoComplete: "off", hint: "Provided by the DeliberateHire AI team after approval." },
    ] : []),
    { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 10 characters." },
  ];
  return (
    <AuthForm
      endpoint="/api/auth/signup"
      submitLabel={invite ? `Join ${invite.orgName}` : "Create workspace"}
      fields={fields}
      extra={{ inviteToken: invite?.token }}
      onSuccess={() => {
        router.push("/dashboard");
        router.refresh();
      }}
    />
  );
}
