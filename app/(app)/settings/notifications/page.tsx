import { FormCard } from "@/components/settings/form-card";
import { requireAuth } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { listOutbox } from "@/lib/services/workspace";

export const metadata = { title: "Email outbox" };

export default async function OutboxPage() {
  const auth = await requireAuth("interview:write");
  const rows = await listOutbox(auth.orgId);
  const provider = env().EMAIL_PROVIDER;
  return (
    <FormCard title="Email outbox" description={provider === "log" ? "No email provider is configured (EMAIL_PROVIDER=log), so emails are recorded here instead of being delivered. Copy links from here while developing." : `Emails are delivered via ${provider}.`}>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No emails yet.</p> : (
        <ul className="-my-2 divide-y">
          {rows.map((r) => (
            <li key={r.id} className="py-3">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">{r.subject}</span><span className="text-muted-foreground">to {r.to_email}</span>
                  <span className={`ml-auto text-xs ${r.status === "sent" ? "text-muted-foreground" : "text-destructive"}`}>{r.status === "sent" ? (r.provider === "log" ? "logged" : "sent") : "failed"} · {formatDate(r.created_at, true)}</span>
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/60 p-3 font-sans text-sm whitespace-pre-wrap">{r.body_text}</pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </FormCard>
  );
}
