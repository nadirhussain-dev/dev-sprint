"use client";
import { useState, useTransition } from "react";
import { Check, ChevronDown, Clock, FileText, Loader2 } from "lucide-react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { setTaskStatus } from "@/app/actions/tasks";
import { useOfflineQueue } from "@/lib/offline/queue";
import { streakMilestone } from "@/lib/domain/motivation";
import { TASK_STATUSES, type CurriculumTask, type TaskStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusBadge: Record<TaskStatus, { label: string; variant: "outline" | "default" | "success" | "warning" | "danger" }> = {
  not_started: { label: "Not started", variant: "outline" },
  in_progress: { label: "In progress", variant: "default" },
  completed: { label: "Done", variant: "success" },
  skipped: { label: "Skipped", variant: "outline" },
  needs_revision: { label: "Needs revision", variant: "warning" },
};

const CHEERS = ["Nice! One more down 💪", "Boom! Keep the momentum ⚡", "Great work — next one! 🚀", "You are on fire 🔥", "Progress unlocked ✨"];

export function TaskItem({ task, status: initialStatus, version, streak, onOpenDetails, compact = false }: {
  task: CurriculumTask;
  status: TaskStatus;
  version: number | null;
  streak?: number;
  onOpenDetails?: () => void;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [ver, setVer] = useState<number | null>(version);
  const [pop, setPop] = useState(false);
  const [pending, startTransition] = useTransition();
  const enqueue = useOfflineQueue((s) => s.enqueue);
  const done = status === "completed";

  const change = (next: TaskStatus) => {
    const prev = status;
    setStatus(next);
    if (next === "completed") { setPop(true); setTimeout(() => setPop(false), 350); }
    if (!navigator.onLine) {
      enqueue({ taskId: task.id, dayNumber: task.day_number, status: next, baseVersion: ver });
      toast("Saved offline — will sync when you reconnect");
      return;
    }
    startTransition(async () => {
      try {
        const res = await setTaskStatus({ taskId: task.id, status: next });
        if (!res.ok) { setStatus(prev); toast.error(res.error); return; }
        setVer(res.data.version);
        if (res.data.streakJustQualified) {
          const nextStreak = (streak ?? 0) + 1;
          toast.success(streakMilestone(nextStreak) ?? `Streak day earned — ${nextStreak} in a row`, { icon: "🔥" });
        } else if (res.data.dayComplete && next === "completed") {
          toast.success("Day crushed! All required tasks are done", { icon: "🏆" });
        } else if (next === "completed") {
          toast.success(CHEERS[Math.floor(Math.random() * CHEERS.length)]!, { duration: 1800 });
        }
        if (next === "needs_revision") toast("Added to your revision queue — it'll come back tomorrow");
      } catch {
        enqueue({ taskId: task.id, dayNumber: task.day_number, status: next, baseVersion: ver });
        toast("Connection lost — change queued");
      }
    });
  };

  return (
    <div className={cn("group flex items-start gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent/60", done && "opacity-70")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        onClick={() => change(done ? "not_started" : "completed")}
        className={cn(
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          done ? "bg-energy border-transparent text-energy-fg shadow-energy" : "border-input hover:border-primary hover:bg-primary/10",
          pop && "animate-pop",
        )}
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("text-sm leading-snug", done && "line-through decoration-muted-foreground/50")}>{task.title}</p>
        {!compact && task.description ? <p className="mt-0.5 text-xs text-muted-foreground">{task.description}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground"><Clock className="h-3 w-3" />{task.estimated_minutes}m</span>
          {task.priority === "high" ? <Badge variant="outline">High priority</Badge> : null}
          {!task.is_required ? <Badge variant="outline">Optional</Badge> : null}
          {status !== "not_started" && status !== "completed" ? <Badge variant={statusBadge[status].variant}>{statusBadge[status].label}</Badge> : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
        {onOpenDetails ? (
          <button type="button" onClick={onOpenDetails} aria-label="Notes, resources and evidence" className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground">
            <FileText className="h-4 w-4" />
          </button>
        ) : null}
        <Menu.Root>
          <Menu.Trigger aria-label="Change status" className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground">
            <ChevronDown className="h-4 w-4" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content align="end" className="z-50 min-w-40 rounded-md border bg-card p-1 text-sm shadow-lg">
              {TASK_STATUSES.map((s) => (
                <Menu.Item key={s.value} onSelect={() => change(s.value)} className="flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-1.5 outline-none data-[highlighted]:bg-accent">
                  {s.label}
                  {status === s.value ? <Check className="h-3.5 w-3.5" /> : null}
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </div>
  );
}
