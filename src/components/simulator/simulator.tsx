"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Eye, Loader2, Shuffle, Mic, Timer } from "lucide-react";
import { toast } from "sonner";
import { recordAttempt } from "@/app/actions/simulator";
import { SELF_RATING_LABELS, scoreAttempt } from "@/lib/domain/scoring";
import { Button } from "@/components/ui/button";
import { Textarea, NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { CodeBlock } from "@/components/ui/code-block";
import { SKILL_LABELS, type InterviewQuestion, type SkillArea } from "@/lib/types";
import { cn } from "@/lib/utils";

type Stage = "answer" | "review" | "done";

export function Simulator({ questions, studiedDays, focusDay, mockDays }: {
  questions: InterviewQuestion[];
  studiedDays: number[];
  focusDay: number | null;
  mockDays: { day_number: number; title: string; skill_area: SkillArea }[];
}) {
  return (
    <Tabs defaultValue="practice">
      <TabsList>
        <TabsTrigger value="practice">Question practice</TabsTrigger>
        <TabsTrigger value="mock">Record a mock interview</TabsTrigger>
      </TabsList>
      <TabsContent value="practice"><Practice questions={questions} studiedDays={studiedDays} focusDay={focusDay} /></TabsContent>
      <TabsContent value="mock"><MockInterview mockDays={mockDays} /></TabsContent>
    </Tabs>
  );
}

function Practice({ questions, studiedDays, focusDay }: { questions: InterviewQuestion[]; studiedDays: number[]; focusDay: number | null }) {
  const studied = useMemo(() => new Set(studiedDays), [studiedDays]);
  const [scope, setScope] = useState<"studied" | "all" | "day">(focusDay ? "day" : "studied");
  const [area, setArea] = useState<"all" | SkillArea>("all");
  const [asked, setAsked] = useState<string[]>([]);
  const [current, setCurrent] = useState<InterviewQuestion | null>(null);
  const [stage, setStage] = useState<Stage>("answer");
  const [answer, setAnswer] = useState("");
  const [covered, setCovered] = useState<Set<number>>(new Set());
  const [rating, setRating] = useState(3);
  const [result, setResult] = useState<{ score: number; queued: boolean } | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [pending, start] = useTransition();

  const pool = useMemo(() => questions.filter((q) => {
    if (area !== "all" && q.skill_area !== area) return false;
    if (scope === "day") return focusDay !== null && q.day_numbers.includes(focusDay);
    if (scope === "studied") return q.day_numbers.some((d) => studied.has(d));
    return true;
  }), [questions, area, scope, focusDay, studied]);

  const next = () => {
    const fresh = pool.filter((q) => !asked.includes(q.id));
    const from = fresh.length ? fresh : pool;
    const pick = from[Math.floor(Math.random() * from.length)];
    if (!pick) return;
    setAsked((a) => (fresh.length ? [...a, pick.id] : [pick.id]));
    setCurrent(pick); setStage("answer"); setAnswer(""); setCovered(new Set()); setRating(3); setResult(null); setStartedAt(Date.now());
  };

  const preview = current ? scoreAttempt(covered.size, current.key_points.length, rating) : 0;
  const areas = [...new Set(questions.map((q) => q.skill_area))];

  const submit = () => current && start(async () => {
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    const res = await recordAttempt({
      kind: "simulator", skill_area: current.skill_area, question_id: current.id, answer,
      key_points_total: current.key_points.length, key_points_covered: covered.size, self_rating: rating,
      notes: `Answered in ${seconds}s`,
    });
    if (!res.ok) { toast.error(res.error); return; }
    setResult({ score: res.data!.score, queued: res.data!.queuedForRevision });
    setStage("done");
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <Card>
        <CardContent className="flex flex-col gap-5 pt-5">
          {!current ? (
            pool.length === 0 ? (
              <EmptyState icon={Mic} title="No questions in this scope yet"
                description={scope === "studied" ? "Complete a task on any day and its questions unlock here. Or switch scope to All topics." : "Try a broader scope."} />
            ) : (
              <EmptyState icon={Shuffle} title={`${pool.length} questions ready`} description="You'll get a random question. Answer out loud or in writing, then score yourself against the rubric honestly — this feeds your readiness score."
                action={<Button className="mt-2" onClick={next}><Shuffle />Start</Button>} />
            )
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{current.category}</Badge>
                <Badge variant="outline" className="capitalize">{current.difficulty}</Badge>
              </div>
              <h2 className="text-lg font-semibold leading-snug">{current.title}</h2>

              {stage === "answer" ? (
                <>
                  <Textarea autoFocus value={answer} onChange={(e) => setAnswer(e.target.value)} className="min-h-40" aria-label="Your answer"
                    placeholder="Answer as you would in an interview. Bullet points are fine. (Optional: answer out loud and just jot notes.)" />
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Timer className="h-3 w-3" />Aim for under 2 minutes</span>
                    <Button onClick={() => setStage("review")}><Eye />Reveal rubric</Button>
                  </div>
                </>
              ) : null}

              {stage !== "answer" ? (
                <div className="flex flex-col gap-4 animate-fade-up">
                  {answer ? <div className="rounded-md border bg-muted/40 p-3 text-sm"><p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Your answer</p><p className="whitespace-pre-wrap">{answer}</p></div> : null}
                  <fieldset className="flex flex-col gap-2" disabled={stage === "done"}>
                    <legend className="mb-1 text-sm font-semibold">Which key points did you actually cover?</legend>
                    {current.key_points.map((k, i) => (
                      <label key={k} className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-foreground/40 has-[:checked]:bg-accent">
                        <input type="checkbox" className="mt-0.5" checked={covered.has(i)} onChange={() => setCovered((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                        {k}
                      </label>
                    ))}
                  </fieldset>
                  <fieldset disabled={stage === "done"}>
                    <legend className="mb-2 text-sm font-semibold">How clearly did you explain it?</legend>
                    <div className="grid grid-cols-5 gap-1.5" role="radiogroup">
                      {[1, 2, 3, 4, 5].map((r) => (
                        <button key={r} type="button" role="radio" aria-checked={rating === r} onClick={() => setRating(r)}
                          className={cn("flex flex-col items-center gap-0.5 rounded-md border px-1 py-2 text-xs", rating === r ? "border-foreground bg-primary text-primary-foreground" : "hover:bg-accent")}>
                          <span className="font-semibold">{r}</span><span className="hidden text-[10px] leading-tight sm:block">{SELF_RATING_LABELS[r]}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <details className="rounded-md border p-3 text-sm">
                    <summary className="cursor-pointer font-medium">Model answer</summary>
                    <p className="mt-2 leading-relaxed">{current.short_answer}</p>
                    {current.code_example ? <div className="mt-2"><CodeBlock code={current.code_example} /></div> : null}
                  </details>
                  {stage === "review" ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Score: <span className="font-mono font-semibold text-foreground">{preview}</span>/100</span>
                      <Button onClick={submit} disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : null}Save score</Button>
                    </div>
                  ) : result ? (
                    <div className="flex flex-col gap-2 rounded-md border p-3">
                      <p className="text-sm"><span className="font-mono text-lg font-semibold">{result.score}</span>/100 saved.
                        {result.queued ? " Below 60, so this question was added to your revision queue." : result.score >= 75 ? " Marked as learned." : ""}</p>
                      <div className="flex gap-2">
                        <Button onClick={next}><Shuffle />Next question</Button>
                        <Button asChild variant="outline"><Link href={`/questions/${current.id}`}>Study this one</Link></Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader><CardTitle>Question pool</CardTitle><CardDescription>{pool.length} questions match</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Scope</span>
            <NativeSelect aria-label="Scope" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
              <option value="studied">Topics I&apos;ve studied</option>
              <option value="all">All topics</option>
              {focusDay ? <option value="day">Day {focusDay} only</option> : null}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Skill area</span>
            <NativeSelect aria-label="Skill area" value={area} onChange={(e) => setArea(e.target.value as typeof area)}>
              <option value="all">All areas</option>
              {areas.map((a) => <option key={a} value={a}>{SKILL_LABELS[a]}</option>)}
            </NativeSelect>
          </div>
          {current ? <Button variant="outline" size="sm" onClick={next}><Shuffle />Skip / new question</Button> : null}
          <p className="text-[11px] leading-relaxed text-muted-foreground">Scoring: 80% from rubric points covered, 20% from your clarity rating. Answers under 60 go to revision automatically.</p>
        </CardContent>
      </Card>
    </div>
  );
}

const DIMENSIONS = ["Technical accuracy", "Problem solving", "Communication", "Depth & trade-offs"];

function MockInterview({ mockDays }: { mockDays: { day_number: number; title: string; skill_area: SkillArea }[] }) {
  const [day, setDay] = useState<number | "">(mockDays[0]?.day_number ?? "");
  const [area, setArea] = useState<SkillArea>(mockDays[0]?.skill_area ?? "javascript_typescript");
  const [ratings, setRatings] = useState<number[]>([3, 3, 3, 3]);
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const score = Math.round(((avg - 1) / 4) * 100);

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Record a mock interview</CardTitle>
        <CardDescription>After a timed mock (with a friend, a peer platform, or recording yourself), rate each dimension honestly. Mock scores make up their own readiness area.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Plan day</span>
            <NativeSelect aria-label="Plan day" value={day} onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : "";
              setDay(v);
              const m = mockDays.find((x) => x.day_number === v);
              if (m) setArea(m.skill_area);
            }}>
              <option value="">Not tied to a day</option>
              {mockDays.map((m) => <option key={m.day_number} value={m.day_number}>Day {m.day_number} · {m.title}</option>)}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Main skill area</span>
            <NativeSelect aria-label="Main skill area" value={area} onChange={(e) => setArea(e.target.value as SkillArea)}>
              {(Object.keys(SKILL_LABELS) as SkillArea[]).map((a) => <option key={a} value={a}>{SKILL_LABELS[a]}</option>)}
            </NativeSelect>
          </div>
        </div>
        {DIMENSIONS.map((d, i) => (
          <div key={d} className="flex flex-col gap-1.5">
            <span className="text-sm">{d}</span>
            <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={d}>
              {[1, 2, 3, 4, 5].map((r) => (
                <button key={r} type="button" role="radio" aria-checked={ratings[i] === r} onClick={() => setRatings((x) => x.map((v, j) => (j === i ? r : v)))}
                  className={cn("rounded-md border py-1.5 text-sm", ratings[i] === r ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>{r}</button>
              ))}
            </div>
          </div>
        ))}
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What went well? What would you do differently? Which topics need revision?" aria-label="Notes" />
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Score <span className="font-mono font-semibold text-foreground">{score}</span>/100</span>
          <Button disabled={pending} onClick={() => start(async () => {
            const res = await recordAttempt({
              kind: "mock_interview", skill_area: area, day_number: day === "" ? undefined : day,
              key_points_total: 0, key_points_covered: 0, self_rating: Math.round(avg), notes,
            }, ratings);
            if (!res.ok) { toast.error(res.error); return; }
            toast.success(`Mock interview saved: ${res.data!.score}/100`);
            setNotes(""); setRatings([3, 3, 3, 3]);
          })}>{pending ? <Loader2 className="animate-spin" /> : null}Save mock interview</Button>
        </div>
      </CardContent>
    </Card>
  );
}
