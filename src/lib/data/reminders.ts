import "server-only";
import { dueReminders } from "@/lib/domain/reminders";
import { computeStreaks } from "@/lib/domain/streaks";
import { rows } from "@/lib/supabase/result";
import type { AppContext } from "./context";
import type { createClient } from "@/lib/supabase/server";
import type { NotificationRow, StreakRow } from "@/lib/types";

type Ctx = AppContext & { supabase: Awaited<ReturnType<typeof createClient>> };

/**
 * In-app reminder fallback: whenever the app is opened, create any reminders whose time has
 * already passed today (deduped per kind per day). Works without push infrastructure.
 */
export async function syncInAppReminders(ctx: Ctx): Promise<NotificationRow[]> {
  const { supabase } = ctx;
  const active = ctx.position.phase === "active";
  const dayNumber = ctx.position.dayNumber;

  const [streakRows, day, required, revision] = await Promise.all([
    supabase.from("daily_streaks").select("local_date, qualified, study_minutes, tasks_completed").gte("local_date", ctx.plan.start_date).then(rows<StreakRow>),
    supabase.from("curriculum_days").select("title, is_mock_interview").eq("day_number", dayNumber).maybeSingle(),
    supabase.from("curriculum_tasks").select("id").eq("day_number", dayNumber).eq("is_required", true).then(rows<{ id: string }>),
    supabase.from("revision_items").select("id", { count: "exact", head: true }).eq("status", "active").lte("due_date", ctx.today),
  ]);
  const done = required.length
    ? rows<{ task_id: string }>(await supabase.from("user_task_progress").select("task_id").eq("status", "completed").in("task_id", required.map((r) => r.id))).length
    : 0;
  const streak = computeStreaks(streakRows, ctx.today);

  const due = dueReminders(ctx.prefs, {
    localDate: ctx.today,
    localTime: ctx.localTime,
    weekday: ctx.weekday,
    planActive: active,
    dayNumber,
    dayTitle: (day.data?.title as string | undefined) ?? "",
    requiredRemaining: Math.max(0, required.length - done),
    todayQualified: streak.todayQualified,
    currentStreak: streak.current,
    isMockDay: Boolean(day.data?.is_mock_interview),
    revisionDue: revision.count ?? 0,
  });
  // Only the most recent reminder of each kind matters; created via a SECURITY DEFINER fn scoped to auth.uid().
  await Promise.all(due.map((r) => supabase.rpc("create_in_app_notification", {
    p_kind: r.kind, p_title: r.title, p_body: r.body, p_url: r.url, p_dedupe: r.dedupeKey,
  })));

  return rows<NotificationRow>(await supabase.from("notifications").select("id, kind, title, body, url, read_at, created_at").order("created_at", { ascending: false }).limit(20));
}
