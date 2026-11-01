"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/data/context";
import { queueRevision } from "@/lib/data/revision";
import type { ActionResult, CodingChallenge } from "@/lib/types";

const Schema = z.object({
  status: z.enum(["not_started", "in_progress", "completed", "needs_revision"]).optional(),
  external_url: z.union([z.literal(""), z.url()]).optional(),
  notes: z.string().max(10000).optional(),
  solved_without_hints: z.boolean().optional(),
});

export async function updateChallenge(challengeId: string, patch: z.input<typeof Schema>): Promise<ActionResult> {
  const parsed = Schema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const ctx = await getAppContext();
  const { data } = await ctx.supabase.from("coding_challenges").select("id, title, skill_area").eq("id", challengeId).maybeSingle();
  if (!data) return { ok: false, error: "Challenge not found" };
  const c = data as Pick<CodingChallenge, "id" | "title" | "skill_area">;
  const v = parsed.data;
  const row: Record<string, unknown> = { user_id: ctx.userId, challenge_id: c.id };
  if (v.status) { row.status = v.status; row.solved_at = v.status === "completed" ? new Date().toISOString() : null; }
  if (v.external_url !== undefined) row.external_url = v.external_url || null;
  if (v.notes !== undefined) row.notes = v.notes;
  if (v.solved_without_hints !== undefined) row.solved_without_hints = v.solved_without_hints;
  const res = await ctx.supabase.from("user_challenge_progress").upsert(row, { onConflict: "user_id,challenge_id" });
  if (res.error) return { ok: false, error: res.error.message };
  if (v.status === "needs_revision") {
    await queueRevision(ctx.supabase, ctx.userId, ctx.today, { source_type: "challenge", source_id: c.id, title: c.title, link: `/coding#${c.id}`, skill_area: c.skill_area });
  }
  revalidatePath("/coding");
  revalidatePath("/analytics");
  return { ok: true };
}
