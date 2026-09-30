"use client";

import { ExternalLink, Link2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { CopyButton } from "@/components/common/copy-button";
import { useAction } from "@/lib/client/use-action";

export function ApplyLinkCard({ jobId, enabled, url, jobActive, canEdit }: { jobId: string; enabled: boolean; url: string | null; jobActive: boolean; canEdit: boolean }) {
  const { run, pending } = useAction();
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><Link2 className="size-4 text-primary" /> Public application link</h2>
          <p className="mt-1 text-sm text-muted-foreground">Share it anywhere. Applicants submit their details and resume; AI screens each one against this job.</p>
        </div>
        {canEdit && (
          <Switch checked={enabled} disabled={!!pending} aria-label="Accept applications"
            onCheckedChange={(c) => run("toggle", `/api/jobs/${jobId}/apply-link`, { body: { enabled: !!c }, success: c ? "Applications are open" : "Applications closed" })} />
        )}
      </div>
      {enabled && url ? (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted/40 px-3 py-1.5 text-xs">{url}</code>
            <CopyButton value={url} />
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex size-7 items-center justify-center rounded-md border hover:bg-muted" aria-label="Open application page"><ExternalLink className="size-3.5" /></a>
          </div>
          {!jobActive && <p className="text-xs text-amber-700 dark:text-amber-400">The job isn&apos;t active, so the page shows “not accepting applications”. Activate the job to receive applications.</p>}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{canEdit ? "Turn on to create the link." : "Applications are closed."}</p>
      )}
    </section>
  );
}
