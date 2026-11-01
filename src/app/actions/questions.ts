"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/data/context";
import { queueRevision } from "@/lib/data/revision";
import type { ActionResult, InterviewQuestion } from "@/lib/types";

const PatchSchema = z.object({
  status: z.enum(["new", "learned", "needs_revision"]).optional(),
  is_favorite: z.boolean().optional(),
  personal_answer: z.string().max(10000).optional(),
});

export async function updateQuestionProgress(questionId: string, patch: z.input<typeof PatchSchema>): Promise<ActionResult> {
  const parsed = PatchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const ctx = await getAppContext();
  const { data: q } = await ctx.supabase.from("interview_questions").select("id, title, skill_area").eq("id", questionId).maybeSingle();
  if (!q) return { ok: false, error: "Question not found" };
  const res = await ctx.supabase.from("user_question_progress").upsert(
    { user_id: ctx.userId, question_id: questionId, ...parsed.data, last_practiced_at: new Date().toISOString() },
    { onConflict: "user_id,question_id" },
  );
  if (res.error) return { ok: false, error: res.error.message };
  if (parsed.data.status === "needs_revision") {
    const question = q as Pick<InterviewQuestion, "id" | "title" | "skill_area">;
    await queueRevision(ctx.supabase, ctx.userId, ctx.today, {
      source_type: "question", source_id: question.id, title: question.title, link: `/questions/${question.id}`, skill_area: question.skill_area,
    });
  }
  revalidatePath("/questions");
  revalidatePath(`/questions/${questionId}`);
  return { ok: true };
}
