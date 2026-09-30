"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/client/api";
import { timeAgo } from "@/lib/format";

type N = { id: string; type: string; payload: Record<string, string>; read_at: string | null; created_at: string };

const label = (n: N) =>
  n.type === "report.ready" ? `Report ready — ${n.payload.candidate} (${n.payload.job})`
  : n.type === "interview.completed" ? `${n.payload.candidate} completed the ${n.payload.job} interview`
  : n.type === "application.received" ? `New application — ${n.payload.candidate} for ${n.payload.job}`
  : n.type;

export function NotificationBell() {
  const [items, setItems] = useState<N[]>([]);
  const load = () => api<{ notifications: N[] }>("/api/notifications").then((r) => setItems(r.notifications)).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <DropdownMenu onOpenChange={(open) => { if (open && unread) api("/api/notifications", { method: "POST", body: {} }).then(load).catch(() => {}); }}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`} className="relative" />}>
        <Bell className="size-4" />
        {unread > 0 && <span className="absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-background" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-sm font-semibold">Notifications</div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>}
          {items.map((n) => (
            <Link key={n.id} href={n.payload.application_id ? `/jobs/${n.payload.job_id}/applications/${n.payload.application_id}` : n.payload.interview_id ? `/interviews/${n.payload.interview_id}` : "/dashboard"} className="block border-b px-3 py-2.5 text-sm last:border-0 hover:bg-muted">
              <p className={n.read_at ? "text-muted-foreground" : "font-medium"}>{label(n)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
            </Link>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
