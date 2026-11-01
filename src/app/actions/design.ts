"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/data/context";
import { queueRevision } from "@/lib/data/revision";
import type { ActionResult } from "@/lib/types";

const Schema = z.object({
  status: z.enum(["not_started", "in_progress", "completed", "needs_revision"]).optional(),
  notes: z.string().max(20000).optional(),
});

export async function updateDesign(exerciseId: string, patch: z.input<typeof Schema>): Promise<ActionResult> {
  const parsed = Schema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const ctx = await getAppContext();
  const { data: ex } = await ctx.supabase.from("system_design_exercises").select("id, slug, title").eq("id", exerciseId).maybeSingle();
  if (!ex) return { ok: false, error: "Exercise not found" };
  const row: Record<string, unknown> = { user_id: ctx.userId, exercise_id: exerciseId };
  if (parsed.data.status) { row.status = parsed.data.status; row.completed_at = parsed.data.status === "completed" ? new Date().toISOString() : null; }
  if (parsed.data.notes !== undefined) row.notes = parsed.data.notes;
  const res = await ctx.supabase.from("user_system_design_progress").upsert(row, { onConflict: "user_id,exercise_id" });
  if (res.error) return { ok: false, error: res.error.message };
  if (parsed.data.status === "needs_revision") {
    await queueRevision(ctx.supabase, ctx.userId, ctx.today, { source_type: "design", source_id: exerciseId, title: `Design: ${ex.title}`, link: `/system-design/${ex.slug}`, skill_area: "system_design" });
  }
  revalidatePath("/system-design");
  revalidatePath(`/system-design/${ex.slug}`);
  return { ok: true };
}
