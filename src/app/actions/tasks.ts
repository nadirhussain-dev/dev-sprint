"use server";
import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/data/context";
import { queueRevision } from "@/lib/data/revision";
import { CustomTaskSchema, TaskDetailsSchema } from "@/lib/validation";
import type { ActionResult, CurriculumTask, Resource, StreakRow, TaskProgress, TaskStatus } from "@/lib/types";

const STATUSES: TaskStatus[] = ["not_started", "in_progress", "completed", "skipped", "needs_revision"];

export interface StatusResult {
  version: number;
  dayComplete: boolean;
  todayQualified: boolean;
  streakJustQualified: boolean;
}

export type SetStatusResult =
  | { ok: true; data: StatusResult }
  | { ok: false; error: string; conflict?: { serverStatus: TaskStatus; serverVersion: number; taskTitle: string } };

function revalidateDay(day: number) {
  revalidatePath("/dashboard");
  revalidatePath("/roadmap");
  revalidatePath(`/roadmap/day/${day}`);
  revalidatePath("/calendar");
}

/**
 * Sets a curriculum task's status. If baseVersion is provided (offline sync) and the server row has
 * changed since, the write is rejected as a conflict instead of silently overwriting.
 */
export async function setTaskStatus(input: { taskId: string; status: TaskStatus; baseVersion?: number | null; force?: boolean }): Promise<SetStatusResult> {
  if (!STATUSES.includes(input.status)) return { ok: false, error: "Invalid status" };
  const ctx = await getAppContext();
  const { supabase, userId } = ctx;

  const { data: task } = await supabase.from("curriculum_tasks").select("*").eq("id", input.taskId).maybeSingle();
  if (!task) return { ok: false, error: "Task not found" };
  const t = task as CurriculumTask;

  const { data: existingRow } = await supabase.from("user_task_progress").select("*").eq("task_id", t.id).maybeSingle();
  const existing = existingRow as TaskProgress | null;

  if (!input.force && input.baseVersion !== undefined) {
    const serverVersion = existing?.version ?? null;
    if (serverVersion !== input.baseVersion && existing && existing.status !== input.status) {
      return { ok: false, error: "Changed on another device", conflict: { serverStatus: existing.status, serverVersion: existing.version, taskTitle: t.title } };
    }
  }

  const { data: before } = await supabase.from("daily_streaks").select("qualified").eq("local_date", ctx.today).maybeSingle();

  const write = existing
    ? await supabase.from("user_task_progress").update({ status: input.status }).eq("id", existing.id).select("version").single()
    : await supabase.from("user_task_progress").insert({ user_id: userId, task_id: t.id, day_number: t.day_number, status: input.status }).select("version").single();
  if (write.error) return { ok: false, error: write.error.message };

  if (input.status === "needs_revision") {
    await queueRevision(supabase, userId, ctx.today, {
      source_type: "task", source_id: t.id, title: t.title, link: `/roadmap/day/${t.day_number}`, skill_area: t.skill_area,
    });
  }

  const [{ data: snap }, { data: today }] = await Promise.all([
    supabase.rpc("refresh_day_progress", { p_day: t.day_number }),
    supabase.rpc("refresh_today"),
  ]);
  revalidateDay(t.day_number);

  const todayRow = today as StreakRow | null;
  const snapshot = snap as { completed_at: string | null } | null;
  return {
    ok: true,
    data: {
      version: (write.data as { version: number }).version,
      dayComplete: Boolean(snapshot?.completed_at),
      todayQualified: Boolean(todayRow?.qualified),
      streakJustQualified: Boolean(todayRow?.qualified) && !before?.qualified,
    },
  };
}

/** Replays queued offline changes. Returns per-op outcomes so the client can surface conflicts. */
export async function syncTaskOps(ops: { id: string; taskId: string; status: TaskStatus; baseVersion: number | null }[]) {
  const results: { id: string; outcome: "applied" | "conflict" | "error"; serverStatus?: TaskStatus; serverVersion?: number; taskTitle?: string; error?: string }[] = [];
  for (const op of ops.slice(0, 100)) {
    const res = await setTaskStatus({ taskId: op.taskId, status: op.status, baseVersion: op.baseVersion });
    if (res.ok) results.push({ id: op.id, outcome: "applied" });
    else if (res.conflict) results.push({ id: op.id, outcome: "conflict", ...res.conflict });
    else results.push({ id: op.id, outcome: "error", error: res.error });
  }
  return results;
}

export async function saveTaskDetails(taskId: string, input: { notes?: string; mistakes?: string; resources?: Resource[] }): Promise<ActionResult> {
  const parsed = TaskDetailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { supabase, userId } = await getAppContext();
  const { data: task } = await supabase.from("curriculum_tasks").select("day_number").eq("id", taskId).maybeSingle();
  if (!task) return { ok: false, error: "Task not found" };
  const { data: existing } = await supabase.from("user_task_progress").select("id").eq("task_id", taskId).maybeSingle();
  const res = existing
    ? await supabase.from("user_task_progress").update(parsed.data).eq("id", existing.id)
    : await supabase.from("user_task_progress").insert({ user_id: userId, task_id: taskId, day_number: task.day_number, ...parsed.data });
  if (res.error) return { ok: false, error: res.error.message };
  revalidatePath(`/roadmap/day/${task.day_number}`);
  return { ok: true, message: "Saved" };
}

export async function addCustomTask(input: { day_number: number; title: string; minutes: number; session: "morning" | "evening" }): Promise<ActionResult> {
  const parsed = CustomTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { supabase, userId } = await getAppContext();
  const v = parsed.data;
  const res = await supabase.from("user_task_progress").insert({
    user_id: userId, day_number: v.day_number, custom_title: v.title, custom_minutes: v.minutes, custom_session: v.session, status: "not_started",
  });
  if (res.error) return { ok: false, error: res.error.message };
  await supabase.rpc("refresh_day_progress", { p_day: v.day_number });
  revalidateDay(v.day_number);
  return { ok: true };
}

export async function setCustomTaskStatus(id: string, status: TaskStatus): Promise<ActionResult> {
  if (!STATUSES.includes(status)) return { ok: false, error: "Invalid status" };
  const { supabase } = await getAppContext();
  const res = await supabase.from("user_task_progress").update({ status }).eq("id", id).is("task_id", null).select("day_number").single();
  if (res.error) return { ok: false, error: res.error.message };
  const day = (res.data as { day_number: number }).day_number;
  await Promise.all([supabase.rpc("refresh_day_progress", { p_day: day }), supabase.rpc("refresh_today")]);
  revalidateDay(day);
  return { ok: true };
}

export async function deleteCustomTask(id: string): Promise<ActionResult> {
  const { supabase } = await getAppContext();
  const res = await supabase.from("user_task_progress").delete().eq("id", id).is("task_id", null).select("day_number").single();
  if (res.error) return { ok: false, error: res.error.message };
  const day = (res.data as { day_number: number }).day_number;
  await Promise.all([supabase.rpc("refresh_day_progress", { p_day: day }), supabase.rpc("refresh_today")]);
  revalidateDay(day);
  return { ok: true };
}

export async function saveDayNote(dayNumber: number, body: string, noteId?: string): Promise<ActionResult> {
  const text = body.trim();
  if (!text || text.length > 10000) return { ok: false, error: "Note must be 1–10,000 characters" };
  const { supabase, userId } = await getAppContext();
  const res = noteId
    ? await supabase.from("user_notes").update({ body: text }).eq("id", noteId)
    : await supabase.from("user_notes").insert({ user_id: userId, entity_type: "day", entity_id: String(dayNumber), body: text });
  if (res.error) return { ok: false, error: res.error.message };
  revalidatePath(`/roadmap/day/${dayNumber}`);
  return { ok: true };
}

export async function deleteNote(noteId: string, path: string): Promise<ActionResult> {
  const { supabase } = await getAppContext();
  const res = await supabase.from("user_notes").delete().eq("id", noteId);
  if (res.error) return { ok: false, error: res.error.message };
  if (path.startsWith("/")) revalidatePath(path);
  return { ok: true };
}
