"use server";
import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/data/context";
import { scheduleNext, type RevisionOutcome } from "@/lib/domain/revision";
import type { ActionResult, RevisionItem } from "@/lib/types";

export async function reviewItem(id: string, outcome: RevisionOutcome): Promise<ActionResult<{ resolved: boolean; dueDate: string }>> {
  if (!["again", "good", "easy"].includes(outcome)) return { ok: false, error: "Invalid outcome" };
  const ctx = await getAppContext();
  const { data } = await ctx.supabase.from("revision_items").select("*").eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "Item not found" };
  const item = data as RevisionItem;
  const next = scheduleNext(item.repetitions, outcome, ctx.today);
  const res = await ctx.supabase.from("revision_items").update({
    repetitions: next.repetitions, interval_days: next.intervalDays, due_date: next.dueDate,
    status: next.resolved ? "resolved" : "active", last_reviewed_at: new Date().toISOString(),
  }).eq("id", id);
  if (res.error) return { ok: false, error: res.error.message };

  // Mastered items clear their "needs revision" flag at the source.
  if (next.resolved) {
    if (item.source_type === "question") await ctx.supabase.from("user_question_progress").update({ status: "learned" }).eq("question_id", item.source_id);
    if (item.source_type === "task") await ctx.supabase.from("user_task_progress").update({ status: "completed" }).eq("task_id", item.source_id).eq("status", "needs_revision");
  }
  revalidatePath("/revision");
  revalidatePath("/dashboard");
  return { ok: true, data: { resolved: next.resolved, dueDate: next.dueDate } };
}

export async function removeRevisionItem(id: string): Promise<ActionResult> {
  const { supabase } = await getAppContext();
  const res = await supabase.from("revision_items").delete().eq("id", id);
  if (res.error) return { ok: false, error: res.error.message };
  revalidatePath("/revision");
  revalidatePath("/dashboard");
  return { ok: true };
}
