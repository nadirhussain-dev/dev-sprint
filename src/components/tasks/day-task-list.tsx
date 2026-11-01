"use client";
import { useState, useTransition } from "react";
import { Moon, Plus, Sun, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TaskItem } from "./task-item";
import { TaskDetailsDialog } from "./task-details-dialog";
import { addCustomTask, deleteCustomTask, setCustomTaskStatus } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { formatMinutes, cn } from "@/lib/utils";
import type { CurriculumTask, Evidence, TaskProgress } from "@/lib/types";

export interface DayTaskListProps {
  dayNumber: number;
  tasks: CurriculumTask[];
  progress: Record<string, TaskProgress>;
  custom: TaskProgress[];
  evidence: Evidence[];
  streak: number;
  morningLabel: string;
  eveningLabel: string;
  allowCustom?: boolean;
}

export function DayTaskList({ dayNumber, tasks, progress, custom, evidence, streak, morningLabel, eveningLabel, allowCustom = true }: DayTaskListProps) {
  const [openTask, setOpenTask] = useState<CurriculumTask | null>(null);
  const sessions = [
    { key: "morning" as const, label: "Morning session", sub: morningLabel, icon: Sun },
    { key: "evening" as const, label: "Evening session", sub: eveningLabel, icon: Moon },
  ];

  return (
    <div className="flex flex-col gap-6">
      {sessions.map((s) => {
        const list = tasks.filter((t) => t.session === s.key);
        const customList = custom.filter((c) => c.custom_session === s.key);
        const minutes = list.reduce((a, t) => a + t.estimated_minutes, 0);
        const done = list.filter((t) => progress[t.id]?.status === "completed").length;
        return (
          <section key={s.key} aria-labelledby={`session-${s.key}`}>
            <div className="mb-1 flex items-center justify-between px-2">
              <h3 id={`session-${s.key}`} className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <s.icon className="h-3.5 w-3.5" />{s.label}
                <span className="font-mono normal-case tracking-normal">· {formatMinutes(minutes)}</span>
              </h3>
              <span className="font-mono text-[11px] text-muted-foreground">{done}/{list.length}</span>
            </div>
            <p className="mb-1 px-2 text-xs text-muted-foreground">{s.sub}</p>
            <div className="flex flex-col">
              {list.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  status={progress[t.id]?.status ?? "not_started"}
                  version={progress[t.id]?.version ?? null}
                  streak={streak}
                  onOpenDetails={() => setOpenTask(t)}
                />
              ))}
              {customList.map((c) => <CustomTaskRow key={c.id} task={c} />)}
            </div>
          </section>
        );
      })}
      {allowCustom ? <AddCustomTask dayNumber={dayNumber} /> : null}
      {openTask ? (
        <TaskDetailsDialog
          key={openTask.id}
          task={openTask}
          progress={progress[openTask.id]}
          evidence={evidence.filter((e) => e.task_id === openTask.id)}
          open
          onOpenChange={(o) => { if (!o) setOpenTask(null); }}
        />
      ) : null}
    </div>
  );
}

function CustomTaskRow({ task }: { task: TaskProgress }) {
  const [pending, start] = useTransition();
  const done = task.status === "completed";
  return (
    <div className={cn("group flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-accent/60", done && "opacity-70")}>
      <input
        type="checkbox"
        aria-label={`Mark "${task.custom_title}" as done`}
        checked={done}
        disabled={pending}
        onChange={() => start(async () => {
          const res = await setCustomTaskStatus(task.id, done ? "not_started" : "completed");
          if (!res.ok) toast.error(res.error);
        })}
        className="h-4 w-4 accent-[var(--primary)]"
      />
      <span className={cn("flex-1 text-sm", done && "line-through")}>{task.custom_title}</span>
      <span className="font-mono text-[11px] text-muted-foreground">{task.custom_minutes}m · yours</span>
      <button aria-label="Delete task" className="text-muted-foreground opacity-0 hover:text-danger group-hover:opacity-100"
        onClick={() => start(async () => { const r = await deleteCustomTask(task.id); if (!r.ok) toast.error(r.error); })}>
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AddCustomTask({ dayNumber }: { dayNumber: number }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [session, setSession] = useState<"morning" | "evening">("evening");
  const [pending, start] = useTransition();
  if (!open) {
    return <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => setOpen(true)}><Plus />Add your own task</Button>;
  }
  return (
    <form
      className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await addCustomTask({ day_number: dayNumber, title, minutes, session });
          if (!res.ok) { toast.error(res.error); return; }
          setTitle(""); setOpen(false);
        });
      }}
    >
      <Input autoFocus aria-label="Task title" placeholder="e.g. Read the Node.js streams docs" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input aria-label="Minutes" type="number" min={5} max={480} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="sm:w-24" />
      <NativeSelect aria-label="Session" value={session} onChange={(e) => setSession(e.target.value as "morning" | "evening")} className="sm:w-32">
        <option value="morning">Morning</option>
        <option value="evening">Evening</option>
      </NativeSelect>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || title.trim().length < 2}>Add</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
