"use client";
import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { useOfflineQueue } from "@/lib/offline/queue";

export function NetworkStatus() {
  const [online, setOnline] = useState(true);
  const pending = useOfflineQueue((s) => s.ops.length);
  const syncing = useOfflineQueue((s) => s.syncing);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (online && pending === 0) return null;
  return (
    <span role="status" className="mr-1 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] text-muted-foreground">
      {online ? <RefreshCw className={syncing ? "h-3 w-3 animate-spin" : "h-3 w-3"} /> : <CloudOff className="h-3 w-3" />}
      {online ? `Syncing ${pending}` : pending ? `Offline · ${pending} queued` : "Offline"}
    </span>
  );
}
