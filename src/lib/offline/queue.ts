"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TaskStatus } from "@/lib/types";

/** A task-status change made while offline (or that failed to send). */
export interface QueuedOp {
  id: string;
  taskId: string;
  dayNumber: number;
  status: TaskStatus;
  /** Server version the change was based on; null if the row didn't exist yet. */
  baseVersion: number | null;
  queuedAt: string;
}

export interface Conflict {
  op: QueuedOp;
  serverStatus: TaskStatus;
  serverVersion: number;
  taskTitle: string;
}

interface QueueState {
  ops: QueuedOp[];
  conflicts: Conflict[];
  syncing: boolean;
  enqueue: (op: Omit<QueuedOp, "id" | "queuedAt">) => void;
  remove: (ids: string[]) => void;
  setConflicts: (c: Conflict[]) => void;
  resolveConflict: (opId: string) => void;
  setSyncing: (v: boolean) => void;
}

export const useOfflineQueue = create<QueueState>()(
  persist(
    (set) => ({
      ops: [],
      conflicts: [],
      syncing: false,
      enqueue: (op) =>
        set((s) => ({
          // Collapse repeated changes to the same task, keeping the ORIGINAL base version for conflict detection.
          ops: [
            ...s.ops.filter((o) => o.taskId !== op.taskId),
            {
              ...op,
              baseVersion: s.ops.find((o) => o.taskId === op.taskId)?.baseVersion ?? op.baseVersion,
              id: crypto.randomUUID(),
              queuedAt: new Date().toISOString(),
            },
          ],
        })),
      remove: (ids) => set((s) => ({ ops: s.ops.filter((o) => !ids.includes(o.id)) })),
      setConflicts: (c) => set((s) => ({ conflicts: [...s.conflicts, ...c] })),
      resolveConflict: (opId) => set((s) => ({ conflicts: s.conflicts.filter((c) => c.op.id !== opId) })),
      setSyncing: (v) => set({ syncing: v }),
    }),
    {
      name: "devsprint-offline-queue",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ ops: s.ops, conflicts: s.conflicts }),
    },
  ),
);
