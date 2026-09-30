"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "./api";

/** Run a mutation with pending state, toast feedback and a server refresh. */
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const run = useCallback(async <T,>(key: string, url: string, opts: { method?: string; body?: unknown; success?: string; refresh?: boolean } = {}): Promise<T | null> => {
    setPending(key);
    try {
      const res = await api<T>(url, { method: opts.method ?? "POST", body: opts.body ?? (opts.method === "DELETE" ? undefined : {}) });
      if (opts.success) toast.success(opts.success);
      if (opts.refresh !== false) router.refresh();
      return res;
    } catch (err) {
      toast.error((err as Error).message);
      return null;
    } finally {
      setPending(null);
    }
  }, [router]);
  return { run, pending };
}
