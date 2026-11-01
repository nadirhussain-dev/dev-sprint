"use client";
import { useState, useTransition } from "react";
import { ChevronDown, Lightbulb, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateChallenge } from "@/app/actions/challenges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { CodeBlock } from "@/components/ui/code-block";
import type { ChallengeProgress, CodingChallenge, ItemStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: { value: ItemStatus; label: string }[] = [
  { value: "not_started", label: "Not started" }, { value: "in_progress", label: "Attempting" },
  { value: "completed", label: "Solved" }, { value: "needs_revision", label: "Needs revision" },
];

export function ChallengeCard({ challenge: c, progress }: { challenge: CodingChallenge; progress: ChallengeProgress | null }) {
  const [open, setOpen] = useState(false);
  const [hints, setHints] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [status, setStatus] = useState<ItemStatus>(progress?.status ?? "not_started");
  const [url, setUrl] = useState(progress?.external_url ?? "");
  const [notes, setNotes] = useState(progress?.notes ?? "");
  const [pending, start] = useTransition();

  const save = (patch: Parameters<typeof updateChallenge>[1], msg?: string) => start(async () => {
    const res = await updateChallenge(c.id, patch);
    if (!res.ok) toast.error(res.error); else if (msg) toast.success(msg);
  });

  const markSolved = () => {
    setStatus("completed");
    // Solving without opening hints or the solution earns full readiness credit.
    save({ status: "completed", solved_without_hints: hints === 0 && !showSolution }, hints === 0 && !showSolution ? "Solved without hints 💪" : "Marked solved");
  };

  return (
    <div id={c.id} className={cn("rounded-lg border bg-card", status === "completed" && "border-success/30")}>
      <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={cn("h-2 w-2 shrink-0 rounded-full", status === "completed" ? "bg-success" : status === "needs_revision" ? "bg-warning" : status === "in_progress" ? "bg-foreground" : "bg-border")} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{c.title}</span>
          <span className="text-xs text-muted-foreground">{c.category}</span>
        </span>
        <Badge variant="outline" className="capitalize">{c.difficulty}</Badge>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="flex flex-col gap-4 border-t px-4 py-4 animate-fade-up">
          <p className="text-sm leading-relaxed">{c.description}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <CodeBlock label="Example input" code={c.example_input} />
            <CodeBlock label="Expected output" code={c.expected_output} />
          </div>
          <p className="text-xs text-muted-foreground">Solve it in your editor or on a practice site. This app tracks your work — it doesn&apos;t execute code.</p>

          <div className="flex flex-col gap-2">
            {c.hints.slice(0, hints).map((h, i) => <p key={i} className="flex gap-2 rounded-md bg-muted px-3 py-2 text-sm"><Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />{h}</p>)}
            <div className="flex flex-wrap gap-2">
              {hints < c.hints.length ? <Button size="sm" variant="outline" onClick={() => setHints(hints + 1)}><Lightbulb />Hint {hints + 1}/{c.hints.length}</Button> : null}
              <Button size="sm" variant="outline" onClick={() => setShowSolution(!showSolution)}>{showSolution ? "Hide" : "Show"} solution</Button>
            </div>
          </div>
          {showSolution ? (
            <div className="flex flex-col gap-2 animate-fade-up">
              <p className="text-sm leading-relaxed">{c.solution_explanation}</p>
              {c.solution_code ? <CodeBlock code={c.solution_code} label="Reference solution" /> : null}
              <p className="font-mono text-xs text-muted-foreground">Time {c.time_complexity} · Space {c.space_complexity}</p>
            </div>
          ) : null}

          <div className="grid gap-3 border-t pt-4 sm:grid-cols-[180px_1fr]">
            <NativeSelect aria-label="Status" value={status} onChange={(e) => { const s = e.target.value as ItemStatus; if (s === "completed") markSolved(); else { setStatus(s); save({ status: s }); } }}>
              {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </NativeSelect>
            <div className="flex gap-2">
              <Input aria-label="Practice URL" placeholder="LeetCode / practice URL" value={url} onChange={(e) => setUrl(e.target.value)} />
              <Button size="sm" variant="outline" disabled={pending} onClick={() => save({ external_url: url }, "Link saved")}>Save</Button>
            </div>
          </div>
          <Textarea aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Your approach, edge cases you missed, complexity…" className="min-h-16" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => save({ notes }, "Notes saved")}>{pending ? <Loader2 className="animate-spin" /> : null}Save notes</Button>
            {status !== "completed" ? <Button size="sm" disabled={pending} onClick={markSolved}>Mark solved</Button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
