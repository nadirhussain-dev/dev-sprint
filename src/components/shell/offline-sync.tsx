"use client";
import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useOfflineQueue } from "@/lib/offline/queue";
import { setTaskStatus, syncTaskOps } from "@/app/actions/tasks";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TASK_STATUSES } from "@/lib/types";

const label = (s: string) => TASK_STATUSES.find((x) => x.value === s)?.label ?? s;

/** Replays queued offline task changes on reconnect and asks the user to resolve conflicts. */
export function OfflineSync() {
  const router = useRouter();
  const { ops, conflicts, remove, setConflicts, resolveConflict, setSyncing } = useOfflineQueue();

  const sync = useCallback(async () => {
    const pending = useOfflineQueue.getState().ops;
    if (pending.length === 0 || !navigator.onLine) return;
    setSyncing(true);
    try {
      const results = await syncTaskOps(pending.map(({ id, taskId, status, baseVersion }) => ({ id, taskId, status, baseVersion })));
      remove(results.filter((r) => r.outcome !== "conflict").map((r) => r.id));
      const found = results.filter((r) => r.outcome === "conflict");
      if (found.length) {
        setConflicts(found.map((r) => ({
          op: pending.find((o) => o.id === r.id)!,
          serverStatus: r.serverStatus!, serverVersion: r.serverVersion!, taskTitle: r.taskTitle ?? "Task",
        })));
        remove(found.map((r) => r.id));
      }
      const applied = results.filter((r) => r.outcome === "applied").length;
      if (applied) toast.success(`Synced ${applied} offline change${applied === 1 ? "" : "s"}`);
      router.refresh();
    } catch {
      // still offline / server unreachable — keep the queue
    } finally {
      setSyncing(false);
    }
  }, [remove, router, setConflicts, setSyncing]);

  useEffect(() => {
    void sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [sync, ops.length]);

  const current = conflicts[0];
  if (!current) return null;
  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent>
        <DialogTitle>Sync conflict</DialogTitle>
        <DialogDescription>
          “{current.taskTitle}” was changed on another device while you were offline.
        </DialogDescription>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">This device (offline)</p><p className="font-medium">{label(current.op.status)}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Other device</p><p className="font-medium">{label(current.serverStatus)}</p></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { resolveConflict(current.op.id); router.refresh(); }}>Keep other device</Button>
          <Button onClick={async () => {
            const res = await setTaskStatus({ taskId: current.op.taskId, status: current.op.status, force: true });
            if (!res.ok) toast.error(res.error);
            resolveConflict(current.op.id);
            router.refresh();
          }}>Keep this device</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
