"use server";
import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/data/context";
import type { ActionResult, Milestone, MilestoneProgress } from "@/lib/types";

async function load(milestoneId: string) {
  const ctx = await getAppContext();
  const [{ data: m }, { data: p }] = await Promise.all([
    ctx.supabase.from("project_milestones").select("*").eq("id", milestoneId).maybeSingle(),
    ctx.supabase.from("user_project_progress").select("*").eq("milestone_id", milestoneId).maybeSingle(),
  ]);
  return { ctx, milestone: m as Milestone | null, progress: p as MilestoneProgress | null };
}

export async function toggleMilestoneTask(milestoneId: string, taskId: string): Promise<ActionResult<{ status: string }>> {
  const { ctx, milestone, progress } = await load(milestoneId);
  if (!milestone || !milestone.tasks.some((t) => t.id === taskId)) return { ok: false, error: "Task not found" };
  const current = new Set(progress?.completed_task_ids ?? []);
  if (current.has(taskId)) current.delete(taskId); else current.add(taskId);
  const ids = milestone.tasks.map((t) => t.id).filter((id) => current.has(id));
  const status = ids.length === 0 ? "not_started" : ids.length === milestone.tasks.length ? "completed" : "in_progress";
  const res = await ctx.supabase.from("user_project_progress").upsert({
    user_id: ctx.userId, milestone_id: milestoneId, completed_task_ids: ids, status,
    completed_at: status === "completed" ? new Date().toISOString() : null,
  }, { onConflict: "user_id,milestone_id" });
  if (res.error) return { ok: false, error: res.error.message };
  revalidatePath("/projects");
  return { ok: true, data: { status } };
}

export async function saveMilestoneNotes(milestoneId: string, notes: string): Promise<ActionResult> {
  if (notes.length > 20000) return { ok: false, error: "Notes are too long" };
  const { ctx, milestone } = await load(milestoneId);
  if (!milestone) return { ok: false, error: "Milestone not found" };
  const res = await ctx.supabase.from("user_project_progress").upsert({ user_id: ctx.userId, milestone_id: milestoneId, notes }, { onConflict: "user_id,milestone_id" });
  if (res.error) return { ok: false, error: res.error.message };
  revalidatePath("/projects");
  return { ok: true };
}
