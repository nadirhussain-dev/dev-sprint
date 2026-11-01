"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/context";
import { ProfileSchema, ReminderSchema, ScheduleSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

function done() {
  revalidatePath("/", "layout");
  return { ok: true as const, message: "Saved" };
}

export async function updateProfile(input: z.input<typeof ProfileSchema>): Promise<ActionResult> {
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { supabase, user } = await requireUser();
  const res = await supabase.from("profiles").update({ ...parsed.data, avatar_url: parsed.data.avatar_url || null }).eq("id", user.id);
  return res.error ? { ok: false, error: res.error.message } : done();
}

const ScheduleUpdate = ScheduleSchema.omit({ morning_reminder_time: true, evening_reminder_time: true }).extend({
  streak_min_minutes: z.coerce.number().int().min(15).max(600),
});

/** Updates study hours / timezone. The plan's start date is never changed here. */
export async function updateSchedule(input: z.input<typeof ScheduleUpdate>): Promise<ActionResult> {
  const parsed = ScheduleUpdate.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { supabase, user } = await requireUser();
  const res = await supabase.from("user_preferences").update(parsed.data).eq("user_id", user.id);
  if (res.error) return { ok: false, error: res.error.message };
  await supabase.rpc("refresh_today");
  return done();
}

export async function updateReminders(input: z.input<typeof ReminderSchema>): Promise<ActionResult> {
  const parsed = ReminderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { supabase, user } = await requireUser();
  const res = await supabase.from("user_preferences").update(parsed.data).eq("user_id", user.id);
  return res.error ? { ok: false, error: res.error.message } : done();
}
