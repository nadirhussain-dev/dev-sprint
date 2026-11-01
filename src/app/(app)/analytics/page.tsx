import type { Metadata } from "next";
import { Gauge, Info } from "lucide-react";
import { getAppContext } from "@/lib/data/context";
import { getAnalytics } from "@/lib/data/analytics";
import { getStreaks, getStudyTotals } from "@/lib/data/progress";
import { formatShortDate } from "@/lib/domain/dates";
import { FULL_CONFIDENCE_ATTEMPTS } from "@/lib/domain/readiness";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/progress/stat";
import { BarList } from "@/components/analytics/bar-list";
import { DailyStudyChart, WeeklyHoursChart } from "@/components/analytics/charts";
import { formatMinutes, pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const ctx = await getAppContext();
  const [a, streaks, study] = await Promise.all([getAnalytics(ctx), getStreaks(ctx), getStudyTotals(ctx)]);
  const r = a.readiness;
  const requiredTotal = a.phases.reduce((s, p) => s + p.total, 0);
  const requiredDone = a.phases.reduce((s, p) => s + p.done, 0);

  // Snapshot completed weeks so reports are kept even if content changes later.
  const finished = a.reports.filter((w) => w.status === "complete");
  if (finished.length) {
    await ctx.supabase.from("weekly_reports").upsert(
      finished.map((w) => ({ user_id: ctx.userId, week_number: w.week, week_start: w.start, week_end: w.end, data: w, generated_at: new Date().toISOString() })),
      { onConflict: "user_id,week_number" },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics & readiness</h1>
        <p className="text-sm text-muted-foreground">Everything here is computed from your saved records.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Curriculum completion" value={`${pct(requiredDone, requiredTotal)}%`} hint={`${requiredDone}/${requiredTotal} required tasks`} />
        <Stat label="Current / longest streak" value={`${streaks.summary.current}d / ${streaks.summary.longest}d`} hint={`${streaks.summary.missedDays} missed days`} />
        <Stat label="Total study" value={formatMinutes(study.total)} hint={`${formatMinutes(study.week)} in the last 7 days`} />
        <Stat label="Coding challenges" value={`${a.challenges.solved}/${a.challenges.total}`} hint={`${a.challenges.clean} without hints`} />
      </section>

      {/* Readiness */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Gauge className="h-4 w-4" />Interview readiness</CardTitle>
          <CardDescription>An internal preparation indicator — not a prediction or guarantee of interview outcomes.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <div className="flex flex-col gap-2">
            <p className="text-5xl font-semibold tabular-nums tracking-tight">{r.overall}<span className="text-xl text-muted-foreground">/100</span></p>
            <Badge variant="outline" className="self-start">{r.band}</Badge>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Ticking tasks off builds <em>coverage</em>, not readiness. Each area scores only from evidence:
              simulator answers and mock interviews (full weight after {FULL_CONFIDENCE_ATTEMPTS} attempts), solved
              challenges, design reviews, and project milestones with attached proof.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-3">
              {r.areas.map((x) => (
                <li key={x.area} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{x.label} <span className="text-[11px] text-muted-foreground">· weight {x.weight}%</span></span>
                    <span className="shrink-0 font-mono text-xs tabular-nums">{x.score}</span>
                  </div>
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-muted" role="meter" aria-label={`${x.label} readiness`} aria-valuenow={x.score} aria-valuemin={0} aria-valuemax={100}>
                    <div className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/30" style={{ width: `${x.coverage}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${x.score}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {x.evidenceCount} evidence · coverage {x.coverage}% · {x.explanation}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground"><span className="mr-1 inline-block h-1.5 w-3 rounded-full bg-primary align-middle" />readiness <span className="ml-3 mr-1 inline-block h-1.5 w-3 rounded-full bg-muted-foreground/30 align-middle" />task coverage</p>
          </div>
        </CardContent>
        <CardContent className="grid gap-4 border-t pt-5 md:grid-cols-3">
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Strong areas</p>
            {r.strong.length ? <ul className="text-sm">{r.strong.map((x) => <li key={x.area}>{x.label} · {x.score}</li>)}</ul> : <p className="text-sm text-muted-foreground">None yet (70+).</p>}</div>
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weak areas</p>
            {r.weak.length ? <ul className="text-sm">{r.weak.map((x) => <li key={x.area}>{x.label} · {x.score}</li>)}</ul> : <p className="text-sm text-muted-foreground">None below 50.</p>}</div>
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommended next</p>
            <ul className="list-disc space-y-1 pl-4 text-sm">{r.recommendations.map((x) => <li key={x}>{x}</li>)}</ul></div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Daily study time</CardTitle><CardDescription>Minutes per plan day · dashed line is the streak minimum</CardDescription></CardHeader>
          <CardContent><DailyStudyChart data={a.daily} streakMin={ctx.prefs.streak_min_minutes} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Weekly hours</CardTitle><CardDescription>Hours per plan week</CardDescription></CardHeader>
          <CardContent><WeeklyHoursChart data={a.weekly} targetHours={Math.round((ctx.prefs.daily_target_minutes * 7) / 60)} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Progress by technology</CardTitle><CardDescription>Required tasks completed</CardDescription></CardHeader>
          <CardContent><BarList items={a.topics.map((t) => ({ label: t.label, value: pct(t.done, t.total), detail: `${t.done}/${t.total}` }))} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Progress by phase</CardTitle></CardHeader>
          <CardContent><BarList items={a.phases.map((p) => ({ label: `${p.phase}. ${p.title}`, value: pct(p.done, p.total), detail: `${p.done}/${p.total}` }))} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Practice modules</CardTitle></CardHeader>
          <CardContent>
            <BarList items={[
              { label: "Questions learned", value: pct(a.questions.learned, a.questions.total), detail: `${a.questions.learned}/${a.questions.total} · ${a.questions.revise} to revise` },
              { label: "Coding challenges solved", value: pct(a.challenges.solved, a.challenges.total), detail: `${a.challenges.solved}/${a.challenges.total}` },
              { label: "System designs completed", value: pct(a.designs.completed, a.designs.total), detail: `${a.designs.completed}/${a.designs.total}` },
            ]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Daily completion trend</CardTitle><CardDescription>Required tasks done per plan day (last 14)</CardDescription></CardHeader>
          <CardContent>
            {a.daily.length === 0 ? <p className="text-sm text-muted-foreground">No days elapsed yet.</p> : (
              <BarList items={a.daily.slice(-14).reverse().map((d) => ({ label: `${d.label} · ${formatShortDate(d.date)}`, value: d.requiredPct, muted: d.requiredPct < 100 }))} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly reports */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Weekly reports</h2>
        {a.reports.length === 0 ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Info className="h-4 w-4" />Your first report appears once week 1 starts.</p> : null}
        {a.reports.map((w) => (
          <Card key={w.week}>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Week {w.week}</CardTitle>
                <CardDescription>{formatShortDate(w.start)} – {formatShortDate(w.end)}</CardDescription>
              </div>
              <Badge variant={w.status === "complete" ? "outline" : "solid"}>{w.status === "complete" ? "Complete" : "In progress"}</Badge>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Completed</p><p className="font-semibold">{w.completedTasks} tasks</p><p className="text-[11px] text-muted-foreground">{w.requiredCompleted}/{w.requiredTasks} required</p></div>
                <div><p className="text-xs text-muted-foreground">Studied</p><p className="font-semibold">{formatMinutes(w.studyMinutes)}</p></div>
                <div><p className="text-xs text-muted-foreground">Streak days</p><p className="font-semibold">{w.streakDays}/{w.daysInWeek}</p></div>
              </div>
              <div className="flex flex-col gap-3 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Missed ({w.missedTasks.length})</p>
                  {w.missedTasks.length ? <ul className="mt-1 list-disc pl-4 text-muted-foreground">{w.missedTasks.slice(0, 5).map((m) => <li key={m}>{m}</li>)}{w.missedTasks.length > 5 ? <li>…and {w.missedTasks.length - 5} more</li> : null}</ul> : <p className="text-muted-foreground">Nothing missed.</p>}
                </div>
                {w.revisionTopics.length ? (
                  <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Needs revision</p><p className="text-muted-foreground">{w.revisionTopics.join(", ")}</p></div>
                ) : null}
                <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prioritize next</p>
                  <ul className="mt-1 list-disc pl-4">{w.priorities.map((p) => <li key={p}>{p}</li>)}</ul></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
