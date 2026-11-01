"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import * as Popover from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { markNotificationsRead } from "@/app/actions/notifications";
import type { NotificationRow } from "@/lib/types";
import { cn } from "@/lib/utils";

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export function NotificationBell({ initial }: { initial: NotificationRow[] }) {
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();
  useEffect(() => setItems(initial), [initial]);

  // Live updates across devices (cron-created reminders appear without a refresh).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload: { new: Record<string, unknown> }) => {
        const n = payload.new as unknown as NotificationRow;
        setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev].slice(0, 20)));
        toast(n.title, { description: n.body });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const unread = items.filter((i) => !i.read_at).length;
  const markAll = () => {
    setItems((prev) => prev.map((p) => ({ ...p, read_at: p.read_at ?? new Date().toISOString() })));
    startTransition(() => { void markNotificationsRead(); });
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative">
          <Bell />
          {unread > 0 ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" /> : null}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className="z-50 w-80 rounded-md border bg-card p-1 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-sm font-medium">Reminders</p>
            {unread > 0 ? <button onClick={markAll} className="text-xs text-muted-foreground hover:text-foreground">Mark all read</button> : null}
          </div>
          {items.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">No reminders yet.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <Popover.Item key={n.id} asChild>
                  <Link href={n.url} className={cn("flex flex-col gap-0.5 rounded px-2 py-2 outline-none data-[highlighted]:bg-accent", !n.read_at && "bg-accent/50")}>
                    <span className="text-sm font-medium">{n.title}</span>
                    <span className="text-xs text-muted-foreground">{n.body}</span>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                  </Link>
                </Popover.Item>
              ))}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
