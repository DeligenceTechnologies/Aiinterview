"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetch server data while background work (AI parsing, report generation) is running. */
export function AutoRefresh({ active, intervalMs = 3000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs, router]);
  return null;
}
