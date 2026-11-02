import "server-only";
import { addDays, diffDays, type ISODate, PLAN_LENGTH } from "@/lib/domain/dates";
import { computeReadiness, readinessAreaFor, AREA_META, type ReadinessArea, type ReadinessResult } from "@/lib/domain/readiness";
import { rows } from "@/lib/supabase/result";
import type { AppContext } from "./context";
import type { createClient } from "@/lib/supabase/server";
import type {
  Attempt, ChallengeProgress, CodingChallenge, CurriculumDay, CurriculumTask, DesignProgress, Evidence, Milestone,
  MilestoneProgress, QuestionProgress, StreakRow, StudyLog, TaskProgress,
} from "@/lib/types";

type Ctx = AppContext & { supabase: Awaited<ReturnType<typeof createClient>> };

export interface WeeklyReport {
  week: number;
  start: ISODate;
  end: ISODate;
  status: "complete" | "in_progress" | "upcoming";
  completedTasks: number;
  requiredTasks: number;
  requiredCompleted: number;
  missedTasks: string[];
  studyMinutes: number;
  streakDays: number;
  daysInWeek: number;
  revisionTopics: string[];
  priorities: string[];
}

export interface AnalyticsData {
  readiness: ReadinessResult;
  daily: { date: ISODate; label: string; minutes: number; verified: number; requiredPct: number }[];
  weekly: { week: string; hours: number }[];
  topics: { area: ReadinessArea; label: string; done: number; total: number }[];
  phases: { phase: number; title: string; done: number; total: number }[];
  challenges: { solved: number; clean: number; total: number };
  questions: { learned: number; revise: number; total: number };
  designs: { completed: number; total: number };
  reports: WeeklyReport[];
}

export async function getAnalytics(ctx: Ctx): Promise<AnalyticsData> {
  const s = ctx.supabase;
  const [days, tasks, progress, logs, streaks, attempts, challenges, challengeProgress, questionsCount, questionProgress, designsCount, designProgress, milestones, milestoneProgress, evidence] = await Promise.all([
    s.from("curriculum_days").select("day_number, week_number, phase_number, phase_title, title, skill_area").order("day_number").then(rows<CurriculumDay>),
    s.from("curriculum_tasks").select("id, day_number, is_required, skill_area, title").then(rows<CurriculumTask>),
    s.from("user_task_progress").select("task_id, day_number, status, completed_local_date").then(rows<TaskProgress>),
    s.from("study_time_logs").select("source, minutes, local_date").then(rows<StudyLog>),
    s.from("daily_streaks").select("local_date, qualified").then(rows<StreakRow>),
    s.from("assessment_attempts").select("kind, skill_area, score, created_at").then(rows<Attempt>),
    s.from("coding_challenges").select("id, difficulty, skill_area").then(rows<CodingChallenge>),
    s.from("user_challenge_progress").select("challenge_id, status, solved_without_hints").then(rows<ChallengeProgress>),
    s.from("interview_questions").select("id", { count: "exact", head: true }),
    s.from("user_question_progress").select("question_id, status").then(rows<QuestionProgress>),
    s.from("system_design_exercises").select("id", { count: "exact", head: true }),
    s.from("user_system_design_progress").select("exercise_id, status").then(rows<DesignProgress>),
    s.from("project_milestones").select("id, tasks").then(rows<Milestone>),
    s.from("user_project_progress").select("milestone_id, completed_task_ids").then(rows<MilestoneProgress>),
    s.from("project_evidence").select("milestone_id").then(rows<Evidence>),
  ]);

  const status = new Map(progress.filter((p) => p.task_id).map((p) => [p.task_id as string, p.status]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  // Coverage per readiness area (task completion, shown separately from readiness)
  const coverageCounts = new Map<ReadinessArea, { done: number; total: number }>();
  for (const t of tasks.filter((x) => x.is_required)) {
    const a = readinessAreaFor(t.skill_area);
    const c = coverageCounts.get(a) ?? { done: 0, total: 0 };
    c.total += 1;
    if (status.get(t.id) === "completed") c.done += 1;
    coverageCounts.set(a, c);
  }
  const coverage: Partial<Record<ReadinessArea, number>> = {};
  for (const [a, c] of coverageCounts) coverage[a] = c.total ? (c.done / c.total) * 100 : 0;

  const challengeStatus = new Map(challengeProgress.map((c) => [c.challenge_id, c]));
  const evidenceMilestones = new Set(evidence.map((e) => e.milestone_id).filter(Boolean));
  const mp = new Map(milestoneProgress.map((m) => [m.milestone_id, m]));

  const readiness = computeReadiness({
    attempts: attempts.map((a) => ({ kind: a.kind, skill_area: a.skill_area, score: a.score, created_at: a.created_at })),
    challenges: challenges.map((c) => ({
      difficulty: c.difficulty, skill_area: c.skill_area,
      solved: challengeStatus.get(c.id)?.status === "completed",
      withoutHints: Boolean(challengeStatus.get(c.id)?.solved_without_hints),
    })),
    milestones: milestones.map((m) => ({
      taskFraction: m.tasks.length ? (mp.get(m.id)?.completed_task_ids.length ?? 0) / m.tasks.length : 0,
      hasEvidence: evidenceMilestones.has(m.id),
    })),
    coverage,
  });

  // Daily series across the plan up to today
  const lastDay = ctx.today < ctx.plan.end_date ? ctx.today : ctx.plan.end_date;
  const minutesByDate = new Map<string, { m: number; v: number }>();
  for (const l of logs) {
    const e = minutesByDate.get(l.local_date) ?? { m: 0, v: 0 };
    e.m += l.minutes;
    if (l.source === "timer") e.v += l.minutes;
    minutesByDate.set(l.local_date, e);
  }
  const requiredByDay = new Map<number, { d: number; t: number }>();
  for (const t of tasks.filter((x) => x.is_required)) {
    const e = requiredByDay.get(t.day_number) ?? { d: 0, t: 0 };
    e.t += 1;
    if (status.get(t.id) === "completed") e.d += 1;
    requiredByDay.set(t.day_number, e);
  }
  const daily: AnalyticsData["daily"] = [];
  if (ctx.today >= ctx.plan.start_date) {
    for (let d = ctx.plan.start_date; d <= lastDay; d = addDays(d, 1)) {
      const n = diffDays(ctx.plan.start_date, d) + 1;
      const r = requiredByDay.get(n);
      daily.push({ date: d, label: `D${n}`, minutes: minutesByDate.get(d)?.m ?? 0, verified: minutesByDate.get(d)?.v ?? 0, requiredPct: r?.t ? Math.round((r.d / r.t) * 100) : 0 });
    }
  }

  const weekly = Array.from({ length: 9 }, (_, i) => {
    const start = addDays(ctx.plan.start_date, i * 7);
    const end = addDays(start, i === 8 ? 3 : 6);
    let m = 0;
    for (const [date, e] of minutesByDate) if (date >= start && date <= end) m += e.m;
    return { week: `W${i + 1}`, hours: Math.round((m / 60) * 10) / 10 };
  });

  const topics = (Object.keys(AREA_META) as ReadinessArea[])
    .filter((a) => coverageCounts.has(a))
    .map((a) => ({ area: a, label: AREA_META[a].label, done: coverageCounts.get(a)!.done, total: coverageCounts.get(a)!.total }));

  const phaseMap = new Map<number, { title: string; done: number; total: number }>();
  for (const d of days) {
    const e = phaseMap.get(d.phase_number) ?? { title: d.phase_title, done: 0, total: 0 };
    const r = requiredByDay.get(d.day_number);
    e.total += r?.t ?? 0;
    e.done += r?.d ?? 0;
    phaseMap.set(d.phase_number, e);
  }

  const reports = buildWeeklyReports(ctx, days, tasks, status, progress, minutesByDate, streaks, taskById, readiness);

  return {
    readiness,
    daily,
    weekly,
    topics,
    phases: [...phaseMap.entries()].map(([phase, e]) => ({ phase, ...e })),
    challenges: {
      solved: challengeProgress.filter((c) => c.status === "completed").length,
      clean: challengeProgress.filter((c) => c.status === "completed" && c.solved_without_hints).length,
      total: challenges.length,
    },
    questions: {
      learned: questionProgress.filter((q) => q.status === "learned").length,
      revise: questionProgress.filter((q) => q.status === "needs_revision").length,
      total: questionsCount.count ?? 0,
    },
    designs: { completed: designProgress.filter((d) => d.status === "completed").length, total: designsCount.count ?? 0 },
    reports,
  };
}

function buildWeeklyReports(
  ctx: Ctx,
  days: CurriculumDay[],
  tasks: CurriculumTask[],
  status: Map<string, string>,
  progress: TaskProgress[],
  minutesByDate: Map<string, { m: number; v: number }>,
  streaks: StreakRow[],
  taskById: Map<string, CurriculumTask>,
  readiness: ReadinessResult,
): WeeklyReport[] {
  const qualified = new Set(streaks.filter((s) => s.qualified).map((s) => s.local_date));
  const out: WeeklyReport[] = [];
  for (let w = 1; w <= Math.ceil(PLAN_LENGTH / 7); w++) {
    const firstDay = (w - 1) * 7 + 1;
    const lastDay = Math.min(PLAN_LENGTH, w * 7);
    const start = addDays(ctx.plan.start_date, firstDay - 1);
    const end = addDays(ctx.plan.start_date, lastDay - 1);
    const statusW: WeeklyReport["status"] = ctx.today > end ? "complete" : ctx.today >= start ? "in_progress" : "upcoming";
    if (statusW === "upcoming") continue;

    const weekTasks = tasks.filter((t) => t.day_number >= firstDay && t.day_number <= lastDay);
    const required = weekTasks.filter((t) => t.is_required);
    const elapsedEnd = ctx.today < end ? addDays(ctx.today, -1) : end;
    const pastDayLimit = diffDays(ctx.plan.start_date, elapsedEnd) + 1;
    const missed = required
      .filter((t) => t.day_number <= pastDayLimit && status.get(t.id) !== "completed" && status.get(t.id) !== "skipped")
      .map((t) => `Day ${t.day_number}: ${t.title}`);
    const completedTasks = progress.filter((p) => p.status === "completed" && p.completed_local_date && p.completed_local_date >= start && p.completed_local_date <= end).length;
    let minutes = 0;
    let streakDays = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      minutes += minutesByDate.get(d)?.m ?? 0;
      if (qualified.has(d)) streakDays += 1;
    }
    const revisionTopics = progress
      .filter((p) => p.status === "needs_revision" && p.task_id && p.day_number >= firstDay && p.day_number <= lastDay)
      .map((p) => taskById.get(p.task_id as string)?.title ?? "")
      .filter(Boolean);

    const nextWeekDays = days.filter((d) => d.day_number > lastDay && d.day_number <= lastDay + 7);
    const priorities: string[] = [];
    if (missed.length) priorities.push(`Catch up on ${missed.length} missed required task${missed.length === 1 ? "" : "s"} — start with the earliest.`);
    if (revisionTopics.length) priorities.push(`Revise: ${revisionTopics.slice(0, 3).join(", ")}${revisionTopics.length > 3 ? "…" : ""}`);
    for (const r of readiness.recommendations.slice(0, 2)) priorities.push(r);
    if (nextWeekDays[0]) priorities.push(`Next up: ${nextWeekDays[0].phase_title} (${nextWeekDays.map((d) => d.title).slice(0, 2).join(", ")}).`);

    out.push({
      week: w, start, end, status: statusW,
      completedTasks,
      requiredTasks: required.length,
      requiredCompleted: required.filter((t) => status.get(t.id) === "completed").length,
      missedTasks: missed,
      studyMinutes: minutes,
      streakDays,
      daysInWeek: lastDay - firstDay + 1,
      revisionTopics,
      priorities: priorities.slice(0, 5),
    });
  }
  return out.reverse();
}
