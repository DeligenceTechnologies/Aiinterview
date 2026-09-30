"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/client/use-action";

export function ReparseButton({ candidateId }: { candidateId: string }) {
  const { run, pending } = useAction();
  return (
    <Button variant="ghost" size="sm" disabled={!!pending} onClick={() => run("parse", `/api/candidates/${candidateId}/parse`, { success: "Resume re-analyzed" })}>
      <RefreshCw className={pending ? "animate-spin" : ""} /> Re-analyze
    </Button>
  );
}
