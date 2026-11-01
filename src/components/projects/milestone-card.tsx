"use client";
import { useState, useTransition } from "react";
import { Check, ChevronDown, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { saveMilestoneNotes, toggleMilestoneTask } from "@/app/actions/projects";
import { EvidenceForm, EvidenceList } from "@/components/tasks/evidence";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/input";
import type { Evidence, Milestone, MilestoneProgress } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MilestoneCard({ milestone: m, progress, evidence, targetDate, overdue }: {
  milestone: Milestone; progress: MilestoneProgress | null; evidence: Evidence[]; targetDate: string; overdue: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(new Set(progress?.completed_task_ids ?? []));
  const [notes, setNotes] = useState(progress?.notes ?? "");
  const [pending, start] = useTransition();
  const pct = Math.round((done.size / m.tasks.length) * 100);
  const complete = done.size === m.tasks.length;

  return (
    <div className={cn("rounded-lg border bg-card", complete && evidence.length && "border-success/30")}>
      <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="font-mono text-[11px] text-muted-foreground">{String(m.position).padStart(2, "0")}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">{m.title}
            {complete ? <Badge variant="success">Done</Badge> : overdue ? <Badge variant="warning">Behind plan</Badge> : null}
            {evidence.length ? <Badge variant="outline"><Paperclip className="h-3 w-3" />{evidence.length}</Badge> : complete ? <Badge variant="warning">Needs evidence</Badge> : null}
          </span>
          <span className="text-xs text-muted-foreground">Target: day {m.target_day} · {targetDate}</span>
        </span>
        <Progress value={pct} className="hidden w-24 sm:block" label={`${m.title} progress`} />
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="flex flex-col gap-4 border-t p-4 animate-fade-up">
          <p className="text-sm text-muted-foreground">{m.description}</p>
          <ul className="flex flex-col">
            {m.tasks.map((t) => {
              const checked = done.has(t.id);
              return (
                <li key={t.id}>
                  <button className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent" disabled={pending} role="checkbox" aria-checked={checked}
                    onClick={() => {
                      setDone((s) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; });
                      start(async () => { const r = await toggleMilestoneTask(m.id, t.id); if (!r.ok) toast.error(r.error); });
                    }}>
                    <span className={cn("grid h-[18px] w-[18px] place-items-center rounded-[4px] border", checked && "border-primary bg-primary text-primary-foreground")}>{checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}</span>
                    <span className={cn(checked && "text-muted-foreground line-through")}>{t.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col gap-2">
            <Textarea aria-label="Milestone notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Decisions, blockers, links…" className="min-h-16" />
            <Button size="sm" variant="secondary" className="self-end" disabled={pending}
              onClick={() => start(async () => { const r = await saveMilestoneNotes(m.id, notes); if (r.ok) toast.success("Notes saved"); else toast.error(r.error); })}>
              {pending ? <Loader2 className="animate-spin" /> : null}Save notes
            </Button>
          </div>
          <div className="flex flex-col gap-3 border-t pt-4">
            <div><p className="text-sm font-semibold">Evidence</p><p className="text-xs text-muted-foreground">A milestone only earns full project readiness with evidence attached.</p></div>
            <EvidenceList items={evidence} />
            <EvidenceForm milestoneId={m.id} defaultTitle={m.title} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
