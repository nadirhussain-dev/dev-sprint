"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data/context";
import { OnboardingSchema, type OnboardingInput } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

export async function completeOnboarding(input: OnboardingInput): Promise<ActionResult> {
  const parsed = OnboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const { supabase, user } = await requireUser();

  const prefs = await supabase.from("user_preferences").update({
    timezone: v.timezone,
    daily_target_minutes: v.daily_target_minutes,
    morning_minutes: v.morning_minutes,
    evening_minutes: v.evening_minutes,
    morning_reminder_time: v.morning_reminder_time,
    evening_reminder_time: v.evening_reminder_time,
  }).eq("user_id", user.id);
  if (prefs.error) return { ok: false, error: prefs.error.message };

  // The start date is fixed once chosen; re-running onboarding never moves it.
  const existing = await supabase.from("learning_plans").select("id").eq("user_id", user.id).maybeSingle();
  if (!existing.data) {
    const plan = await supabase.from("learning_plans").insert({ user_id: user.id, start_date: v.start_date });
    if (plan.error) return { ok: false, error: plan.error.message };
  }

  const profile = await supabase.from("profiles").update({
    full_name: v.full_name,
    avatar_url: v.avatar_url || null,
    experience_level: v.experience_level,
    target_level: v.target_level,
    target_position: v.target_position,
    onboarded: true,
  }).eq("id", user.id);
  if (profile.error) return { ok: false, error: profile.error.message };

  redirect("/dashboard");
}
