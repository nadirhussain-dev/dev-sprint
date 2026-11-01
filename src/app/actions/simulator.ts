"use server";
import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/data/context";
import { queueRevision } from "@/lib/data/revision";
import { scoreAttempt } from "@/lib/domain/scoring";
import { AttemptSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";
import type { z } from "zod";

/** Records a scored self-assessment. Score is computed on the server from rubric coverage + rating. */
export async function recordAttempt(input: z.input<typeof AttemptSchema>, ratings?: number[]): Promise<ActionResult<{ score: number; queuedForRevision: boolean }>> {
  const parsed = AttemptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  if (v.key_points_covered > v.key_points_total) return { ok: false, error: "Covered points exceed the rubric" };
  const ctx = await getAppContext();

  let score: number;
  if (v.kind === "mock_interview") {
    const rs = (ratings ?? []).filter((r) => Number.isInteger(r) && r >= 1 && r <= 5);
    if (rs.length < 3) return { ok: false, error: "Rate every rubric dimension" };
    const avg = rs.reduce((a, b) => a + b, 0) / rs.length;
    score = Math.round(((avg - 1) / 4) * 100);
  } else {
    score = scoreAttempt(v.key_points_covered, v.key_points_total, v.self_rating);
  }

  const res = await ctx.supabase.from("assessment_attempts").insert({
    user_id: ctx.userId, kind: v.kind, skill_area: v.skill_area, question_id: v.question_id ?? null,
    exercise_id: v.exercise_id ?? null, day_number: v.day_number ?? null, answer: v.answer ?? null,
    key_points_total: v.key_points_total, key_points_covered: v.key_points_covered,
    self_rating: v.self_rating, score, notes: v.notes ?? null,
  });
  if (res.error) return { ok: false, error: res.error.message };

  let queuedForRevision = false;
  if (v.question_id) {
    const { data: q } = await ctx.supabase.from("interview_questions").select("id, title, skill_area").eq("id", v.question_id).maybeSingle();
    if (q) {
      const status = score >= 75 ? "learned" : score < 60 ? "needs_revision" : undefined;
      await ctx.supabase.from("user_question_progress").upsert(
        { user_id: ctx.userId, question_id: q.id, ...(status ? { status } : {}), last_practiced_at: new Date().toISOString() },
        { onConflict: "user_id,question_id" },
      );
      if (score < 60) {
        await queueRevision(ctx.supabase, ctx.userId, ctx.today, {
          source_type: "question", source_id: q.id as string, title: q.title as string, link: `/questions/${q.id}`,
          skill_area: q.skill_area as z.infer<typeof AttemptSchema>["skill_area"],
        });
        queuedForRevision = true;
      }
    }
  }
  revalidatePath("/simulator");
  revalidatePath("/analytics");
  return { ok: true, data: { score, queuedForRevision } };
}
