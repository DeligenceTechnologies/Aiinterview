"use client";

import Link from "next/link";
import { MoreHorizontal, Pause, Pencil, Play, Sparkles, Trash2, XCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useAction } from "@/lib/client/use-action";
import { useRouter } from "next/navigation";

export function JobActions({ jobId, status }: { jobId: string; status: string }) {
  const { run, pending } = useAction();
  const router = useRouter();
  const setStatus = (s: string, msg: string) => run("status", `/api/jobs/${jobId}/status`, { body: { status: s }, success: msg });
  return (
    <>
      {status !== "active" && status !== "closed" && (
        <Button variant="outline" disabled={!!pending} onClick={() => setStatus("active", "Job activated")}><Play /> Activate</Button>
      )}
      {status === "active" && <Button variant="outline" disabled={!!pending} onClick={() => setStatus("paused", "Job paused")}><Pause /> Pause</Button>}
      <Link href={`/jobs/${jobId}/edit`} className={buttonVariants({ variant: "outline" })}><Pencil /> Edit</Link>
      <ConfirmDialog
        title="Delete this job?"
        description="Jobs with interviews can't be deleted — close them instead. This can't be undone."
        confirmLabel="Delete job"
        destructive
        onConfirm={async () => { const r = await run("delete", `/api/jobs/${jobId}`, { method: "DELETE", success: "Job deleted", refresh: false }); if (r) router.push("/jobs"); }}
        trigger={(openDelete) => (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="More actions" />}><MoreHorizontal /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => run("parse", `/api/jobs/${jobId}/parse`, { success: "Requirements re-analyzed" })}><Sparkles /> Re-analyze description</DropdownMenuItem>
              {status !== "closed" && <DropdownMenuItem onClick={() => setStatus("closed", "Job closed")}><XCircle /> Close job</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={openDelete}><Trash2 /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
    </>
  );
}
