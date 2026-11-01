import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpenCheck, Code2, Info, Mic, Target } from "lucide-react";
import { getAppContext } from "@/lib/data/context";
import { dayTaskStats, getDay, getDayExtras, getStreaks } from "@/lib/data/progress";
import { rows } from "@/lib/supabase/result";
import { formatLongDate } from "@/lib/domain/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DayTaskList } from "@/components/tasks/day-task-list";
import { DayNotes } from "@/components/tasks/day-notes";
import { formatMinutes } from "@/lib/utils";
import type { InterviewQuestion, TaskProgress } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ day: string }> }): Promise<Metadata> {
  const { day } = await params;
  return { title: `Day ${day}` };
}

export default async function DayPage({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params;
  const n = Number(day);
  if (!Number.isInteger(n) || n < 1 || n > 60) notFound();

  const ctx = await getAppContext();
  const [bundle, streaks, related] = await Promise.all([
    getDay(ctx, n),
    getStreaks(ctx),
    ctx.supabase.from("interview_questions").select("id, slug, title, difficulty, category").contains("day_numbers", [n]).then(rows<Pick<InterviewQuestion, "id" | "slug" | "title" | "difficulty" | "category">>),
  ]);
  if (!bundle) notFound();
  const extras = await getDayExtras(ctx, n, bundle.tasks.map((t) => t.id));
  const stats = dayTaskStats(bundle);
  const d = bundle.day;
  const today = ctx.position.phase === "active" ? ctx.position.dayNumber : ctx.position.phase === "finished" ? 61 : 0;
  const relation = n === today ? "today" : n < today ? "past" : "future";

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center justify-between text-sm">
        <Link href="/roadmap" className="text-muted-foreground hover:text-foreground">← Roadmap</Link>
        <div className="flex gap-1">
          <Button asChild variant="outline" size="icon" aria-label="Previous day" className={n === 1 ? "pointer-events-none opacity-40" : ""}><Link href={`/roadmap/day/${n - 1}`}><ArrowLeft /></Link></Button>
          <Button asChild variant="outline" size="icon" aria-label="Next day" className={n === 60 ? "pointer-events-none opacity-40" : ""}><Link href={`/roadmap/day/${n + 1}`}><ArrowRight /></Link></Button>
        </div>
      </nav>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Week {d.week_number}</Badge>
          <Badge variant="outline">Phase {d.phase_number} · {d.phase_title}</Badge>
          {relation === "today" ? <Badge variant="solid">Today</Badge> : null}
          {d.is_mock_interview ? <Badge><Mic className="h-3 w-3" />Mock interview</Badge> : null}
          {d.is_revision ? <Badge>Revision day</Badge> : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Day {n}: {d.title}</h1>
        <p className="text-sm text-muted-foreground">{formatLongDate(bundle.date)} · {formatMinutes(stats.plannedMinutes)} planned</p>
        <div className="mt-1 flex items-center gap-3">
          <Progress value={stats.requiredPct} className="max-w-xs" label="Required tasks completed" />
          <span className="font-mono text-xs text-muted-foreground">{stats.requiredDone}/{stats.requiredTotal} required · {stats.allPct}% overall</span>
          {stats.complete ? <Badge variant="success">Day complete</Badge> : null}
        </div>
      </header>

      {relation === "past" && !stats.complete ? (
        <p className="flex items-start gap-2 rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Catching up is great — completing this day&apos;s tasks updates your curriculum progress, but past streak days are never changed retroactively.
        </p>
      ) : null}
      {relation === "future" ? (
        <p className="flex items-start gap-2 rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />This day is in the future. You can work ahead; it won&apos;t be counted as missed before its date.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
          <CardContent>
            <DayTaskList
              dayNumber={n}
              tasks={bundle.tasks}
              progress={Object.fromEntries(bundle.progress) as Record<string, TaskProgress>}
              custom={bundle.custom}
              evidence={extras.evidence}
              streak={streaks.summary.current}
              morningLabel={`Concepts & theory · ${d.morning_focus}`}
              eveningLabel={`Coding & practice · ${d.evening_focus}`}
            />
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-4 w-4" />Learning objectives</CardTitle></CardHeader>
            <CardContent><ul className="list-disc space-y-1 pl-4 text-sm">{d.objectives.map((o) => <li key={o}>{o}</li>)}</ul></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Mic className="h-4 w-4" />Interview questions</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              <ul className="list-disc space-y-1 pl-4 text-sm">{d.interview_questions.map((q) => <li key={q}>{q}</li>)}</ul>
              {related.length ? (
                <div className="mt-2 border-t pt-2">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">In the question bank</p>
                  {related.map((q) => <Link key={q.id} href={`/questions/${q.id}`} className="block py-0.5 text-xs hover:underline">{q.title}</Link>)}
                  <Button asChild size="sm" variant="outline" className="mt-2 w-full"><Link href={`/simulator?day=${n}`}>Practice in simulator</Link></Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Code2 className="h-4 w-4" />Coding assignments</CardTitle></CardHeader>
            <CardContent><ul className="list-disc space-y-1 pl-4 text-sm">{d.coding_assignments.map((o) => <li key={o}>{o}</li>)}</ul></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BookOpenCheck className="h-4 w-4" />Practical outcomes</CardTitle></CardHeader>
            <CardContent><ul className="list-disc space-y-1 pl-4 text-sm">{d.practical_outcomes.map((o) => <li key={o}>{o}</li>)}</ul></CardContent>
          </Card>
        </aside>
      </div>

      <Card>
        <CardHeader><CardTitle>Notes for Day {n}</CardTitle></CardHeader>
        <CardContent><DayNotes dayNumber={n} notes={extras.notes} /></CardContent>
      </Card>
    </div>
  );
}
