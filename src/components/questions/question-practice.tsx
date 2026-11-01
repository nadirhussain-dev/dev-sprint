"use client";
import { useState, useTransition } from "react";
import { Eye, Loader2, RotateCcw, Star, Check } from "lucide-react";
import { toast } from "sonner";
import { updateQuestionProgress } from "@/app/actions/questions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { CodeBlock } from "@/components/ui/code-block";
import type { InterviewQuestion, QuestionProgress } from "@/lib/types";
import { cn } from "@/lib/utils";

export function QuestionPractice({ question, progress, startHidden }: { question: InterviewQuestion; progress: QuestionProgress | null; startHidden: boolean }) {
  const [revealed, setRevealed] = useState(!startHidden);
  const [status, setStatus] = useState(progress?.status ?? "new");
  const [favorite, setFavorite] = useState(progress?.is_favorite ?? false);
  const [answer, setAnswer] = useState(progress?.personal_answer ?? "");
  const [pending, start] = useTransition();

  const patch = (p: Parameters<typeof updateQuestionProgress>[1], msg?: string) => start(async () => {
    const res = await updateQuestionProgress(question.id, p);
    if (!res.ok) toast.error(res.error); else if (msg) toast.success(msg);
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={status === "learned" ? "default" : "outline"} disabled={pending}
          onClick={() => { const s = status === "learned" ? "new" : "learned"; setStatus(s); patch({ status: s }, s === "learned" ? "Marked as learned" : undefined); }}>
          <Check />Learned
        </Button>
        <Button size="sm" variant={status === "needs_revision" ? "default" : "outline"} disabled={pending}
          onClick={() => { const s = status === "needs_revision" ? "new" : "needs_revision"; setStatus(s); patch({ status: s }, s === "needs_revision" ? "Added to revision queue" : undefined); }}>
          <RotateCcw />Needs revision
        </Button>
        <Button size="sm" variant="outline" disabled={pending} aria-pressed={favorite}
          onClick={() => { setFavorite(!favorite); patch({ is_favorite: !favorite }); }}>
          <Star className={cn(favorite && "fill-current")} />{favorite ? "Favorited" : "Favorite"}
        </Button>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Your answer</h2>
        <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer in your own words before revealing. Aim for 60–90 seconds spoken." className="min-h-28" aria-label="Your answer" />
        <Button size="sm" variant="secondary" className="self-end" disabled={pending} onClick={() => patch({ personal_answer: answer }, "Answer saved")}>
          {pending ? <Loader2 className="animate-spin" /> : null}Save answer
        </Button>
      </section>

      {!revealed ? (
        <Button onClick={() => setRevealed(true)} className="self-start"><Eye />Reveal answer</Button>
      ) : (
        <div className="flex flex-col gap-5 animate-fade-up">
          <section className="rounded-lg border bg-muted/40 p-4">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Interview-ready answer</h2>
            <p className="text-sm leading-relaxed">{question.short_answer}</p>
          </section>
          <section>
            <h2 className="mb-1 text-sm font-semibold">Key points interviewers listen for</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm">{question.key_points.map((k) => <li key={k}>{k}</li>)}</ul>
          </section>
          <section>
            <h2 className="mb-1 text-sm font-semibold">Detailed explanation</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{question.explanation}</p>
          </section>
          {question.code_example ? <CodeBlock code={question.code_example} label="Example" /> : null}
          {question.real_world_example ? (
            <section><h2 className="mb-1 text-sm font-semibold">Real-world example</h2><p className="text-sm text-muted-foreground">{question.real_world_example}</p></section>
          ) : null}
          <section className="grid gap-4 sm:grid-cols-2">
            <div><h2 className="mb-1 text-sm font-semibold">Common follow-ups</h2><ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{question.follow_ups.map((f) => <li key={f}>{f}</li>)}</ul></div>
            <div><h2 className="mb-1 text-sm font-semibold">Related concepts</h2><div className="flex flex-wrap gap-1.5">{question.related_concepts.map((r) => <span key={r} className="rounded-md border px-2 py-0.5 text-xs">{r}</span>)}</div></div>
          </section>
        </div>
      )}
    </div>
  );
}
