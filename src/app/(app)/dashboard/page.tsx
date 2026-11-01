import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock, Flame, ListTodo, Mic, RotateCcw, Trophy } from "lucide-react";
import { getAppContext } from "@/lib/data/context";
import { dayTaskStats, getDay, getDayExtras, getOverallProgress, getRevisionDue, getStreaks, getStudyTotals } from "@/lib/data/progress";
import { rows } from "@/lib/supabase/result";
import { addDays, formatShortDate, greeting } from "@/lib/domain/dates";
import { motivationalMessage } from "@/lib/domain/motivation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { Stat } from "@/components/progress/stat";
import { Heatmap } from "@/components/progress/heatmap";
import { DayTaskList } from "@/components/tasks/day-task-list";
import { StudyTimer } from "@/components/timer/study-timer";
import { formatMinutes } from "@/lib/utils";
import type { CurriculumDay, Milestone, TaskProgress } from "@/lib/types";

export const metadata: Metadata = { title: "Today" };

export default async function DashboardPage() {
  const ctx = await getAppContext();
  const { position } = ctx;
  const todayNumber = position.dayNumber;

  const [streaks, overall, study, revision, bundle, upcomingDays, milestones] = await Promise.all([
    getStreaks(ctx),
    getOverallProgress(ctx),
    getStudyTotals(ctx),
    getRevisionDue(ctx),
    position.phase === "finished" ? Promise.resolve(null) : getDay(ctx, todayNumber),
    ctx.supabase.from("curriculum_days").select("*").gt("day_number", position.phase === "not_started" ? 0 : todayNumber).order("day_number").limit(position.phase === "not_started" ? 4 : 3).then(rows<CurriculumDay>),
    ctx.supabase.from("project_milestones").select("*").gte("target_day", todayNumber).order("target_day").limit(3).then(rows<Milestone>),
  ]);
  const [mockDays, extras] = await Promise.all([
    ctx.supabase.from("curriculum_days").select("day_number, title").eq("is_mock_interview", true).gte("day_number", todayNumber).order("day_number").limit(3).then(rows<{ day_number: number; title: string }>),
    bundle ? getDayExtras(ctx, todayNumber, bundle.tasks.map((t) => t.id)) : Promise.resolve({ notes: [], evidence: [] }),
  ]);

  const s = streaks.summary;
  const yesterday = addDays(ctx.today, -1);
  const message = motivationalMessage({
    current: s.current, longest: s.longest, todayQualified: s.todayQualified, atRisk: s.atRisk,
    missedYesterday: s.missedDates.includes(yesterday), dayNumber: todayNumber, phase: position.phase, overallPct: overall.pct,
  });
  const stats = bundle ? dayTaskStats(bundle) : null;
  const firstName = (ctx.profile.full_name ?? "").split(" ")[0] || "there";
  const nextTask = bundle?.tasks.find((t) => t.is_required && bundle.progress.get(t.id)?.status !== "completed");
  const progressRecord: Record<string, TaskProgress> = bundle ? Object.fromEntries(bundle.progress) : {};
  const subjects = bundle?.day.topics.length ? bundle.day.topics : ["General study"];

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome */}
      <section className="flex flex-col gap-1">
        <p className="font-mono text-xs text-muted-foreground">
          {position.phase === "active" ? `DAY ${todayNumber} OF 60 · WEEK ${Math.ceil(todayNumber / 7)}` : position.phase === "not_started" ? `STARTS ${formatShortDate(ctx.plan.start_date).toUpperCase()}` : "SPRINT COMPLETE"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{greeting(ctx.hour)}, {firstName}.</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </section>

      {/* Accountability banner */}
      {position.phase === "active" && stats ? (
        <section className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center ${s.atRisk ? "border-warning/40 bg-warning/5" : ""}`}>
          {stats.complete ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : s.atRisk ? <AlertTriangle className="h-5 w-5 shrink-0 text-warning" /> : <ListTodo className="h-5 w-5 shrink-0" />}
          <div className="flex-1">
            <p className="text-sm font-medium">
              {stats.complete ? "Today's required work is done." : `${stats.requiredTotal - stats.requiredDone} required task${stats.requiredTotal - stats.requiredDone === 1 ? "" : "s"} left today`}
              {s.atRisk ? ` — your ${s.current}-day streak is at risk.` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.complete ? "Anything else is extra credit." : nextTask ? `Next up: ${nextTask.title}` : ""}
              {!s.todayQualified ? ` · Streak needs all required tasks or ${formatMinutes(ctx.prefs.streak_min_minutes)} timed study (${formatMinutes(study.todayVerified)} so far).` : ""}
            </p>
          </div>
          <div className="w-full sm:w-40"><Progress value={stats.requiredPct} label="Today's required tasks" /><p className="mt-1 text-right font-mono text-[11px] text-muted-foreground">{stats.requiredDone}/{stats.requiredTotal} required</p></div>
        </section>
      ) : null}

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Flame} label="Current streak" value={<span className={s.todayQualified ? "" : "text-muted-foreground"}>{s.current}d</span>} hint={`Longest ${s.longest}d · ${s.missedDays} missed`} />
        <Stat icon={Trophy} label="Curriculum" value={`${overall.pct}%`} hint={`${overall.requiredCompleted}/${overall.requiredTotal} required · ${overall.daysCompleted} days complete`} />
        <Stat icon={Clock} label="Study time" value={formatMinutes(study.total)} hint={`${formatMinutes(study.week)} this week · ${formatMinutes(study.today)} today`} />
        <Stat icon={ListTodo} label="Tasks" value={overall.allCompleted} hint={`${overall.remainingTasks} remaining`} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Today's learning */}
          {position.phase === "finished" ? (
            <Card><CardContent className="pt-5"><EmptyState icon={Trophy} title="You completed the 60-day sprint" description="Review your readiness report and plan what's next." action={<Button asChild size="sm" className="mt-2"><Link href="/analytics">Open readiness report</Link></Button>} /></CardContent></Card>
          ) : bundle ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Phase {bundle.day.phase_number} · {bundle.day.phase_title}</Badge>
                  {bundle.day.is_mock_interview ? <Badge variant="solid">Mock interview</Badge> : null}
                  {bundle.day.is_revision ? <Badge>Revision</Badge> : null}
                </div>
                <CardTitle className="text-lg">{position.phase === "not_started" ? "Preview — " : ""}Day {bundle.day.day_number}: {bundle.day.title}</CardTitle>
                <CardDescription>{stats ? `${formatMinutes(stats.plannedMinutes)} planned · ${stats.allPct}% of all tasks done` : null}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-3 rounded-md bg-muted/60 p-3 text-xs sm:grid-cols-2">
                  <div><p className="mb-1 font-medium">Objectives</p><ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">{bundle.day.objectives.map((o) => <li key={o}>{o}</li>)}</ul></div>
                  <div><p className="mb-1 font-medium">Interview questions</p><ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">{bundle.day.interview_questions.slice(0, 4).map((q) => <li key={q}>{q}</li>)}</ul></div>
                </div>
                <DayTaskList
                  dayNumber={bundle.day.day_number}
                  tasks={bundle.tasks}
                  progress={progressRecord}
                  custom={bundle.custom}
                  evidence={extras.evidence}
                  streak={s.current}
                  morningLabel={`Concepts & theory · ${bundle.day.morning_focus}`}
                  eveningLabel={`Coding & practice · ${bundle.day.evening_focus}`}
                />
                <Button asChild variant="link" size="sm" className="self-start"><Link href={`/roadmap/day/${bundle.day.day_number}`}>Open full day page <ArrowRight /></Link></Button>
              </CardContent>
            </Card>
          ) : null}

          {/* Heatmap */}
          <Card>
            <CardHeader><CardTitle>Consistency</CardTitle><CardDescription>{s.last7Qualified}/7 streak days this week · {s.activeDays} active days total</CardDescription></CardHeader>
            <CardContent><Heatmap start={ctx.plan.start_date} end={ctx.plan.end_date} today={ctx.today} days={streaks.rows} targetMinutes={ctx.prefs.daily_target_minutes} /></CardContent>
          </Card>
        </div>

        {/* Right panel */}
        <aside className="flex flex-col gap-4">
          <StudyTimer
            active={study.activeTimer}
            serverNow={Date.now()}
            subjects={subjects}
            dayNumber={position.phase === "active" ? todayNumber : null}
            defaultSlot={ctx.hour < 14 ? "morning" : "evening"}
            todayMinutes={study.today}
            todayVerified={study.todayVerified}
            targetMinutes={ctx.prefs.daily_target_minutes}
            streakMinMinutes={ctx.prefs.streak_min_minutes}
          />

          <Card>
            <CardHeader className="flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><RotateCcw className="h-4 w-4" />Due for revision</CardTitle><Badge variant={revision.due.length ? "warning" : "outline"}>{revision.due.length}</Badge></CardHeader>
            <CardContent className="flex flex-col gap-1">
              {revision.due.length === 0 ? <p className="text-xs text-muted-foreground">Nothing due. Mark tasks or questions as “Needs revision” and they&apos;ll come back here on a schedule.</p> : (
                <>
                  {revision.due.slice(0, 4).map((r) => <Link key={r.id} href="/revision" className="truncate rounded px-1 py-1 text-sm hover:bg-accent">{r.title}</Link>)}
                  <Button asChild variant="outline" size="sm" className="mt-2"><Link href="/revision">Review now</Link></Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4" />Coming up</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {upcomingDays.map((d, i) => (
                <Link key={d.id} href={`/roadmap/day/${d.day_number}`} className="flex flex-col rounded-md px-1 py-0.5 hover:bg-accent">
                  <span className="text-[11px] text-muted-foreground">{i === 0 && position.phase === "active" ? "Tomorrow" : formatShortDate(addDays(ctx.plan.start_date, d.day_number - 1))} · Day {d.day_number}</span>
                  <span className="font-medium">{d.title}</span>
                </Link>
              ))}
              {mockDays.length ? (
                <div className="border-t pt-3">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"><Mic className="h-3 w-3" />Mock interviews</p>
                  {mockDays.map((m) => <Link key={m.day_number} href={`/roadmap/day/${m.day_number}`} className="block truncate text-xs hover:underline">Day {m.day_number} · {m.title}</Link>)}
                </div>
              ) : null}
              {milestones.length ? (
                <div className="border-t pt-3">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Project milestones</p>
                  {milestones.map((m) => <Link key={m.id} href="/projects" className="block truncate text-xs hover:underline">By day {m.target_day} · {m.title}</Link>)}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
