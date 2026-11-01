"use client";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateDesign } from "@/app/actions/design";
import { recordAttempt } from "@/app/actions/simulator";
import { scoreAttempt, SELF_RATING_LABELS } from "@/lib/domain/scoring";
import { Button } from "@/components/ui/button";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DesignExercise, DesignProgress, ItemStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DesignWorkspace({ exercise, progress }: { exercise: DesignExercise; progress: DesignProgress | null }) {
  const [status, setStatus] = useState<ItemStatus>(progress?.status ?? "not_started");
  const [notes, setNotes] = useState(progress?.notes ?? "");
  const [covered, setCovered] = useState<Set<number>>(new Set());
  const [rating, setRating] = useState(3);
  const [pending, start] = useTransition();

  const save = (patch: Parameters<typeof updateDesign>[1], msg: string) => start(async () => {
    const r = await updateDesign(exercise.id, patch);
    if (!r.ok) toast.error(r.error); else toast.success(msg);
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle>Your design notes</CardTitle><CardDescription>Design it yourself first (45 minutes), then compare with the reference sections.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-48 font-mono text-xs" aria-label="Architecture notes"
            placeholder={"Requirements:\n- …\n\nEstimates:\n- …\n\nAPI:\n- …\n\nData model:\n- …\n\nTrade-offs:\n- …"} />
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect aria-label="Status" className="w-44" value={status} onChange={(e) => { const s = e.target.value as ItemStatus; setStatus(s); save({ status: s }, "Status updated"); }}>
              <option value="not_started">Not started</option><option value="in_progress">In progress</option>
              <option value="completed">Completed</option><option value="needs_revision">Needs revision</option>
            </NativeSelect>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => save({ notes }, "Notes saved")} className="ml-auto">{pending ? <Loader2 className="animate-spin" /> : null}Save notes</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Self-review</CardTitle><CardDescription>Score your design against the interview rubric. This counts toward System Design readiness.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {exercise.key_points.map((k, i) => (
            <label key={k} className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:bg-accent">
              <input type="checkbox" className="mt-0.5" checked={covered.has(i)} onChange={() => setCovered((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />{k}
            </label>
          ))}
          <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Clarity rating">
            {[1, 2, 3, 4, 5].map((r) => (
              <button key={r} type="button" role="radio" aria-checked={rating === r} title={SELF_RATING_LABELS[r]} onClick={() => setRating(r)}
                className={cn("rounded-md border py-1.5 text-sm", rating === r ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>{r}</button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Score <span className="font-mono font-semibold text-foreground">{scoreAttempt(covered.size, exercise.key_points.length, rating)}</span>/100</span>
            <Button size="sm" disabled={pending} onClick={() => start(async () => {
              const r = await recordAttempt({ kind: "system_design", skill_area: "system_design", exercise_id: exercise.id, key_points_total: exercise.key_points.length, key_points_covered: covered.size, self_rating: rating, answer: notes.slice(0, 10000) });
              if (!r.ok) { toast.error(r.error); return; }
              toast.success(`Design review saved: ${r.data!.score}/100`);
              setCovered(new Set());
            })}>Save review</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
