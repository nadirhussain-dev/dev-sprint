import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { isPushConfigured, sendPush, type PushTarget } from "@/lib/push/server";
import { planPosition, timeInTz, todayInTz, weekdayInTz } from "@/lib/domain/dates";
import { computeStreaks } from "@/lib/domain/streaks";
import { dueReminders, type ReminderPrefs } from "@/lib/domain/reminders";

export const dynamic = "force-dynamic";

/** Reminders scheduled within this many minutes before "now" are sent. Call this route every 15 minutes. */
const WINDOW_MINUTES = 15;

function authorized(req: NextRequest): boolean {
  const secret = serverEnv().cronSecret;
  const header = req.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const pushReady = isPushConfigured();
  const now = new Date();

  const { data: plans, error } = await admin.from("learning_plans").select("user_id, start_date, end_date");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let created = 0, pushed = 0;
  for (const plan of plans ?? []) {
    const userId = plan.user_id as string;
    const { data: prefs } = await admin.from("user_preferences").select("*").eq("user_id", userId).maybeSingle();
    if (!prefs) continue;
    const tz = prefs.timezone as string;
    const today = todayInTz(tz, now);
    const pos = planPosition(plan.start_date as string, today);

    const [streakRows, day, required, done, revision] = await Promise.all([
      admin.from("daily_streaks").select("local_date, qualified, study_minutes, tasks_completed").eq("user_id", userId),
      admin.from("curriculum_days").select("title, is_mock_interview").eq("day_number", pos.dayNumber).maybeSingle(),
      admin.from("curriculum_tasks").select("id").eq("day_number", pos.dayNumber).eq("is_required", true),
      admin.from("user_task_progress").select("task_id").eq("user_id", userId).eq("day_number", pos.dayNumber).eq("status", "completed").not("task_id", "is", null),
      admin.from("revision_items").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active").lte("due_date", today),
    ]);
    const requiredIds = new Set((required.data ?? []).map((r) => r.id as string));
    const doneCount = (done.data ?? []).filter((d) => requiredIds.has(d.task_id as string)).length;
    const streak = computeStreaks((streakRows.data ?? []) as Parameters<typeof computeStreaks>[0], today);

    const due = dueReminders(prefs as unknown as ReminderPrefs, {
      localDate: today, localTime: timeInTz(tz, now), weekday: weekdayInTz(tz, now),
      planActive: pos.phase === "active", dayNumber: pos.dayNumber, dayTitle: (day.data?.title as string) ?? "",
      requiredRemaining: Math.max(0, requiredIds.size - doneCount), todayQualified: streak.todayQualified,
      currentStreak: streak.current, isMockDay: Boolean(day.data?.is_mock_interview), revisionDue: revision.count ?? 0,
    }, WINDOW_MINUTES);
    if (due.length === 0) continue;

    const { data: subs } = pushReady ? await admin.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", userId) : { data: [] };
    for (const r of due) {
      // Dedupe: the unique (user_id, dedupe_key) constraint means each reminder is delivered once per day.
      const { data: inserted } = await admin.from("notifications")
        .upsert({ user_id: userId, kind: r.kind, title: r.title, body: r.body, url: r.url, dedupe_key: r.dedupeKey }, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
        .select("id");
      if (!inserted?.length) continue;
      created += 1;
      let delivered = false;
      for (const s of (subs ?? []) as PushTarget[]) {
        const res = await sendPush(s, { title: r.title, body: r.body, url: r.url, tag: r.kind });
        if (res === "ok") { delivered = true; pushed += 1; await admin.from("push_subscriptions").update({ last_success_at: now.toISOString(), failure_count: 0 }).eq("endpoint", s.endpoint); }
        if (res === "gone") await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
      if (delivered) await admin.from("notifications").update({ pushed: true }).eq("id", inserted[0]!.id);
    }
  }
  return NextResponse.json({ ok: true, created, pushed, pushConfigured: pushReady });
}

export const GET = run;
export const POST = run;
