import "server-only";
import { addDays, type ISODate } from "@/lib/domain/dates";
import { computeStreaks, type StreakSummary } from "@/lib/domain/streaks";
import { rows, one } from "@/lib/supabase/result";
import type { AppContext } from "./context";
import type { createClient } from "@/lib/supabase/server";
import type {
  CurriculumDay, CurriculumTask, DailyProgress, Evidence, NoteRow, RevisionItem, StreakRow, StudyLog, StudySession, TaskProgress,
} from "@/lib/types";

type Ctx = AppContext & { supabase: Awaited<ReturnType<typeof createClient>> };

export async function getStreaks(ctx: Ctx): Promise<{ summary: StreakSummary; rows: StreakRow[] }> {
  // Re-evaluate today on the server (idempotent; only ever writes today's row).
  await ctx.supabase.rpc("refresh_today");
  const data = rows<StreakRow>(await ctx.supabase.from("daily_streaks").select("*").order("local_date"));
  return { summary: computeStreaks(data, ctx.today, { start: ctx.plan.start_date, end: ctx.plan.end_date }), rows: data };
}

export interface OverallProgress {
  requiredTotal: number;
  requiredCompleted: number;
  allTotal: number;
  allCompleted: number;
  pct: number;
  daysCompleted: number;
  remainingTasks: number;
}

export async function getOverallProgress(ctx: Ctx): Promise<OverallProgress> {
  const [tasks, progress] = await Promise.all([
    ctx.supabase.from("curriculum_tasks").select("id, is_required").then(rows<{ id: string; is_required: boolean }>),
    ctx.supabase.from("user_task_progress").select("task_id, day_number, status").then(rows<Pick<TaskProgress, "task_id" | "day_number" | "status">>),
  ]);
  const required = new Set(tasks.filter((t) => t.is_required).map((t) => t.id));
  const completed = progress.filter((p) => p.status === "completed");
  const customTotal = progress.filter((p) => p.task_id === null).length;
  const requiredCompleted = completed.filter((p) => p.task_id && required.has(p.task_id)).length;

  // A day is complete only when all its required tasks are complete.
  const requiredByDay = new Map<number, number>();
  const all = await ctx.supabase.from("curriculum_tasks").select("day_number").eq("is_required", true).then(rows<{ day_number: number }>);
  for (const t of all) requiredByDay.set(t.day_number, (requiredByDay.get(t.day_number) ?? 0) + 1);
  const doneByDay = new Map<number, number>();
  for (const p of completed) if (p.task_id && required.has(p.task_id)) doneByDay.set(p.day_number, (doneByDay.get(p.day_number) ?? 0) + 1);
  let daysCompleted = 0;
  for (const [day, n] of requiredByDay) if ((doneByDay.get(day) ?? 0) >= n) daysCompleted += 1;

  const allTotal = tasks.length + customTotal;
  return {
    requiredTotal: required.size,
    requiredCompleted,
    allTotal,
    allCompleted: completed.length,
    pct: required.size ? Math.round((requiredCompleted / required.size) * 100) : 0,
    daysCompleted,
    remainingTasks: allTotal - completed.length,
  };
}

export interface StudyTotals { today: number; todayVerified: number; week: number; total: number; activeTimer: StudySession | null; logs: StudyLog[] }

export async function getStudyTotals(ctx: Ctx): Promise<StudyTotals> {
  const [logs, timer] = await Promise.all([
    ctx.supabase.from("study_time_logs").select("id, source, subject, session_slot, day_number, minutes, ended_at, local_date").order("ended_at", { ascending: false }).then(rows<StudyLog>),
    ctx.supabase.from("study_sessions").select("*").neq("status", "stopped").maybeSingle().then(one<StudySession>),
  ]);
  const weekStart = addDays(ctx.today, -6);
  const sum = (xs: StudyLog[]) => xs.reduce((s, l) => s + l.minutes, 0);
  const todayLogs = logs.filter((l) => l.local_date === ctx.today);
  return {
    today: sum(todayLogs),
    todayVerified: sum(todayLogs.filter((l) => l.source === "timer")),
    week: sum(logs.filter((l) => l.local_date >= weekStart && l.local_date <= ctx.today)),
    total: sum(logs),
    activeTimer: timer,
    logs,
  };
}

export interface DayBundle {
  day: CurriculumDay;
  tasks: CurriculumTask[];
  progress: Map<string, TaskProgress>;
  custom: TaskProgress[];
  snapshot: DailyProgress | null;
  date: ISODate;
}

export async function getDay(ctx: Ctx, dayNumber: number): Promise<DayBundle | null> {
  const [day, tasks, progress, snapshot] = await Promise.all([
    ctx.supabase.from("curriculum_days").select("*").eq("day_number", dayNumber).maybeSingle().then(one<CurriculumDay>),
    ctx.supabase.from("curriculum_tasks").select("*").eq("day_number", dayNumber).order("session").order("position").then(rows<CurriculumTask>),
    ctx.supabase.from("user_task_progress").select("*").eq("day_number", dayNumber).order("created_at").then(rows<TaskProgress>),
    ctx.supabase.from("user_daily_progress").select("*").eq("day_number", dayNumber).maybeSingle().then(one<DailyProgress>),
  ]);
  if (!day) return null;
  return {
    day,
    tasks,
    progress: new Map(progress.filter((p) => p.task_id).map((p) => [p.task_id as string, p])),
    custom: progress.filter((p) => !p.task_id),
    snapshot,
    date: addDays(ctx.plan.start_date, dayNumber - 1),
  };
}

export async function getDayExtras(ctx: Ctx, dayNumber: number, taskIds: string[]) {
  const [notes, evidence] = await Promise.all([
    ctx.supabase.from("user_notes").select("*").eq("entity_type", "day").eq("entity_id", String(dayNumber)).order("updated_at", { ascending: false }).then(rows<NoteRow>),
    taskIds.length
      ? ctx.supabase.from("project_evidence").select("*").in("task_id", taskIds).order("created_at", { ascending: false }).then(rows<Evidence>)
      : Promise.resolve([] as Evidence[]),
  ]);
  return { notes, evidence };
}

export function dayTaskStats(bundle: DayBundle) {
  const required = bundle.tasks.filter((t) => t.is_required);
  const done = (id: string) => bundle.progress.get(id)?.status === "completed";
  const requiredDone = required.filter((t) => done(t.id)).length;
  const allDone = bundle.tasks.filter((t) => done(t.id)).length + bundle.custom.filter((c) => c.status === "completed").length;
  const allTotal = bundle.tasks.length + bundle.custom.length;
  const plannedMinutes = bundle.tasks.reduce((s, t) => s + t.estimated_minutes, 0) + bundle.custom.reduce((s, c) => s + (c.custom_minutes ?? 0), 0);
  const doneMinutes =
    bundle.tasks.filter((t) => done(t.id)).reduce((s, t) => s + t.estimated_minutes, 0) +
    bundle.custom.filter((c) => c.status === "completed").reduce((s, c) => s + (c.custom_minutes ?? 0), 0);
  return {
    requiredTotal: required.length,
    requiredDone,
    requiredPct: required.length ? Math.round((requiredDone / required.length) * 100) : 0,
    allDone,
    allTotal,
    allPct: allTotal ? Math.round((allDone / allTotal) * 100) : 0,
    plannedMinutes,
    doneMinutes,
    complete: required.length > 0 && requiredDone === required.length,
  };
}

export async function getRevisionDue(ctx: Ctx): Promise<{ due: RevisionItem[]; upcoming: RevisionItem[] }> {
  const items = rows<RevisionItem>(await ctx.supabase.from("revision_items").select("*").eq("status", "active").order("due_date"));
  return { due: items.filter((i) => i.due_date <= ctx.today), upcoming: items.filter((i) => i.due_date > ctx.today) };
}

/** Per-day completion % for all 60 days (roadmap, calendar, analytics). */
export async function getAllDayCompletion(ctx: Ctx): Promise<Map<number, { requiredTotal: number; requiredDone: number; anyActivity: boolean }>> {
  const [tasks, progress] = await Promise.all([
    ctx.supabase.from("curriculum_tasks").select("id, day_number, is_required").then(rows<{ id: string; day_number: number; is_required: boolean }>),
    ctx.supabase.from("user_task_progress").select("task_id, day_number, status").then(rows<Pick<TaskProgress, "task_id" | "day_number" | "status">>),
  ]);
  const status = new Map(progress.filter((p) => p.task_id).map((p) => [p.task_id as string, p.status]));
  const out = new Map<number, { requiredTotal: number; requiredDone: number; anyActivity: boolean }>();
  for (let d = 1; d <= 60; d++) out.set(d, { requiredTotal: 0, requiredDone: 0, anyActivity: false });
  for (const t of tasks) {
    const e = out.get(t.day_number)!;
    const s = status.get(t.id);
    if (t.is_required) { e.requiredTotal += 1; if (s === "completed") e.requiredDone += 1; }
    if (s && s !== "not_started") e.anyActivity = true;
  }
  for (const p of progress) if (!p.task_id && p.status !== "not_started") out.get(p.day_number)!.anyActivity = true;
  return out;
}
