"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/data/context";
import { PLAN_LENGTH } from "@/lib/domain/dates";
import type { ActionResult, StudySession } from "@/lib/types";

const StartSchema = z.object({
  subject: z.string().trim().min(1, "Pick a subject").max(120),
  slot: z.enum(["morning", "evening"]),
  mode: z.enum(["stopwatch", "countdown"]),
  targetMinutes: z.number().int().min(1).max(300).optional(),
  dayNumber: z.number().int().min(1).max(PLAN_LENGTH).nullable(),
});

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

function friendly(message: string) {
  if (message.includes("TIMER_ACTIVE")) return "A timer is already running (maybe on another device). Stop it first.";
  return message;
}

export async function startTimer(input: z.input<typeof StartSchema>): Promise<ActionResult<StudySession>> {
  const parsed = StartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const { supabase } = await getAppContext();
  const { data, error } = await supabase.rpc("start_timer", {
    p_subject: v.subject, p_slot: v.slot, p_mode: v.mode,
    p_target_seconds: v.mode === "countdown" ? (v.targetMinutes ?? 25) * 60 : null,
    p_day: v.dayNumber,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  refresh();
  return { ok: true, data: data as StudySession };
}

export async function pauseTimer(): Promise<ActionResult<StudySession>> {
  const { supabase } = await getAppContext();
  const { data, error } = await supabase.rpc("pause_timer");
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as StudySession };
}

export async function resumeTimer(): Promise<ActionResult<StudySession>> {
  const { supabase } = await getAppContext();
  const { data, error } = await supabase.rpc("resume_timer");
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as StudySession };
}

export async function stopTimer(): Promise<ActionResult<{ minutes: number; capped: boolean; qualified: boolean }>> {
  const { supabase, today } = await getAppContext();
  const { data, error } = await supabase.rpc("stop_timer");
  if (error) return { ok: false, error: error.message };
  const { data: row } = await supabase.from("daily_streaks").select("qualified").eq("local_date", today).maybeSingle();
  refresh();
  const r = data as { minutes: number; capped: boolean };
  return { ok: true, data: { minutes: r.minutes, capped: r.capped, qualified: Boolean(row?.qualified) } };
}

const ManualSchema = z.object({
  minutes: z.number().int().min(1).max(480),
  subject: z.string().trim().min(1).max(120),
  slot: z.enum(["morning", "evening"]),
  dayNumber: z.number().int().min(1).max(PLAN_LENGTH).nullable(),
  confirmed: z.literal(true, "Please confirm the entry"),
});

export async function addManualTime(input: z.input<typeof ManualSchema>): Promise<ActionResult> {
  const parsed = ManualSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const { supabase } = await getAppContext();
  const { error } = await supabase.rpc("add_manual_time", { p_minutes: v.minutes, p_subject: v.subject, p_slot: v.slot, p_day: v.dayNumber });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: `Logged ${v.minutes} minutes` };
}

export async function deleteManualLog(id: string): Promise<ActionResult> {
  const { supabase } = await getAppContext();
  const { error } = await supabase.from("study_time_logs").delete().eq("id", id).eq("source", "manual");
  if (error) return { ok: false, error: error.message };
  await supabase.rpc("refresh_today");
  refresh();
  return { ok: true };
}
