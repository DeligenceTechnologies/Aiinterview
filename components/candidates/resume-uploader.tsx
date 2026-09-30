"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileText, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ResumeUploader({ candidateId, hasResume }: { candidateId: string; hasResume: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) return toast.error("Resume files must be 10 MB or smaller.");
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/resume`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      toast.success("Resume uploaded — extracting experience with AI");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
      className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center transition-colors", drag ? "border-primary bg-accent" : "bg-muted/30")}
    >
      {busy ? <Loader2 className="size-6 animate-spin text-muted-foreground" /> : hasResume ? <FileText className="size-6 text-muted-foreground" /> : <UploadCloud className="size-6 text-muted-foreground" />}
      <p className="mt-2 text-sm font-medium">{busy ? "Uploading…" : hasResume ? "Replace resume" : "Upload resume"}</p>
      <p className="text-xs text-muted-foreground">Drag & drop or <button type="button" className="font-medium text-primary hover:underline" onClick={() => input.current?.click()} disabled={busy}>browse</button> · PDF, DOCX or TXT up to 10 MB</p>
      <input ref={input} type="file" accept=".pdf,.docx,.txt" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
    </div>
  );
}
