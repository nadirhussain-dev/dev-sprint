import { z } from "zod";
import { isISODate, isValidTimezone, PLAN_LENGTH } from "@/lib/domain/dates";

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM").transform((t) => t.slice(0, 5));
const minutes = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

export const ScheduleSchema = z.object({
  timezone: z.string().refine(isValidTimezone, "Unknown timezone"),
  daily_target_minutes: minutes(30, 960),
  morning_minutes: minutes(0, 480),
  evening_minutes: minutes(0, 480),
  morning_reminder_time: time,
  evening_reminder_time: time,
});

export const OnboardingSchema = ScheduleSchema.extend({
  full_name: z.string().trim().min(1, "Tell us your name").max(80),
  avatar_url: z.union([z.literal(""), z.url("Must be a URL")]).optional(),
  start_date: z.string().refine(isISODate, "Pick a valid date"),
  experience_level: z.enum(["junior", "mid", "senior"]),
  target_level: z.enum(["mid", "senior"]),
  target_position: z.string().trim().min(2).max(80),
});
export type OnboardingInput = z.input<typeof OnboardingSchema>;

export const ReminderSchema = z.object({
  morning_reminder_enabled: z.boolean(), morning_reminder_time: time,
  evening_reminder_enabled: z.boolean(), evening_reminder_time: time,
  incomplete_reminder_enabled: z.boolean(), incomplete_reminder_time: time,
  streak_warning_enabled: z.boolean(), streak_warning_time: time,
  weekly_revision_enabled: z.boolean(), weekly_revision_dow: z.coerce.number().int().min(0).max(6), weekly_revision_time: time,
  mock_reminder_enabled: z.boolean(), mock_reminder_time: time,
});

export const ProfileSchema = z.object({
  full_name: z.string().trim().min(1).max(80),
  avatar_url: z.union([z.literal(""), z.url()]).optional(),
  experience_level: z.enum(["junior", "mid", "senior"]),
  target_level: z.enum(["mid", "senior"]),
  target_position: z.string().trim().min(2).max(80),
});

export const ResourceSchema = z.object({ title: z.string().trim().min(1).max(120), url: z.url() });

export const TaskDetailsSchema = z.object({
  notes: z.string().max(5000).optional(),
  mistakes: z.string().max(5000).optional(),
  resources: z.array(ResourceSchema).max(20).optional(),
});

export const CustomTaskSchema = z.object({
  day_number: z.coerce.number().int().min(1).max(PLAN_LENGTH),
  title: z.string().trim().min(2).max(160),
  minutes: z.coerce.number().int().min(5).max(480),
  session: z.enum(["morning", "evening"]),
});

export const EvidenceSchema = z.object({
  title: z.string().trim().min(2).max(160),
  github_url: z.union([z.literal(""), z.url()]).optional(),
  demo_url: z.union([z.literal(""), z.url()]).optional(),
  explanation: z.string().trim().min(20, "Explain what you built and why (20+ characters)").max(4000),
  milestone_id: z.uuid().optional(),
  task_id: z.uuid().optional(),
}).refine((v) => v.milestone_id || v.task_id, "Evidence must belong to a milestone or task");

export const AttemptSchema = z.object({
  kind: z.enum(["simulator", "mock_interview", "system_design"]),
  skill_area: z.enum(["javascript_typescript", "react_next", "backend", "databases", "oop_solid", "dsa", "system_design", "project", "communication", "ai_engineering"]),
  question_id: z.uuid().optional(),
  exercise_id: z.uuid().optional(),
  day_number: z.coerce.number().int().min(1).max(PLAN_LENGTH).optional(),
  answer: z.string().max(10000).optional(),
  key_points_total: z.number().int().min(0).max(30),
  key_points_covered: z.number().int().min(0).max(30),
  self_rating: z.number().int().min(1).max(5),
  notes: z.string().max(4000).optional(),
});
