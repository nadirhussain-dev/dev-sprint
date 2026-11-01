import type { SkillArea, Difficulty } from "@content/types";

export type { SkillArea, Difficulty };
export type TaskStatus = "not_started" | "in_progress" | "completed" | "skipped" | "needs_revision";
export type ItemStatus = "not_started" | "in_progress" | "completed" | "needs_revision";
export type SessionSlot = "morning" | "evening";

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "skipped", label: "Skipped" },
  { value: "needs_revision", label: "Needs revision" },
];

export interface Profile {
  id: string; email: string; full_name: string | null; avatar_url: string | null;
  experience_level: "junior" | "mid" | "senior"; target_level: "mid" | "senior";
  target_position: string; onboarded: boolean;
}

export interface Preferences {
  user_id: string; timezone: string; daily_target_minutes: number; morning_minutes: number; evening_minutes: number;
  streak_min_minutes: number;
  morning_reminder_enabled: boolean; morning_reminder_time: string;
  evening_reminder_enabled: boolean; evening_reminder_time: string;
  incomplete_reminder_enabled: boolean; incomplete_reminder_time: string;
  streak_warning_enabled: boolean; streak_warning_time: string;
  weekly_revision_enabled: boolean; weekly_revision_dow: number; weekly_revision_time: string;
  mock_reminder_enabled: boolean; mock_reminder_time: string;
}

export interface Plan { id: string; user_id: string; start_date: string; end_date: string }

export interface CurriculumDay {
  id: string; day_number: number; week_number: number; phase_number: number; phase_title: string; title: string;
  skill_area: SkillArea; morning_focus: string; evening_focus: string; topics: string[]; objectives: string[];
  interview_questions: string[]; coding_assignments: string[]; practical_outcomes: string[];
  is_mock_interview: boolean; is_revision: boolean;
}

export interface CurriculumTask {
  id: string; day_id: string; day_number: number; session: SessionSlot; position: number; title: string;
  description: string | null; task_type: "learn" | "practice" | "questions" | "assignment" | "mock" | "recap";
  estimated_minutes: number; priority: "high" | "medium" | "low"; is_required: boolean; skill_area: SkillArea;
}

export interface Resource { title: string; url: string }

export interface TaskProgress {
  id: string; user_id: string; task_id: string | null; day_number: number;
  custom_title: string | null; custom_minutes: number | null; custom_session: SessionSlot | null;
  status: TaskStatus; notes: string | null; mistakes: string | null; resources: Resource[];
  completed_at: string | null; completed_local_date: string | null; version: number; updated_at: string;
}

export interface DailyProgress {
  day_number: number; required_total: number; required_completed: number; all_total: number; all_completed: number;
  completion_pct: number; completed_at: string | null;
}

export interface StreakRow {
  local_date: string; day_number: number | null; study_minutes: number; verified_minutes: number;
  tasks_completed: number; required_total: number; required_completed: number; qualified: boolean;
  qualified_reason: string | null;
}

export interface StudySession {
  id: string; mode: "stopwatch" | "countdown"; target_seconds: number | null; subject: string;
  session_slot: SessionSlot; day_number: number | null; status: "running" | "paused" | "stopped";
  started_at: string; last_resumed_at: string | null; accumulated_seconds: number;
}

export interface StudyLog {
  id: string; source: "timer" | "manual"; subject: string; session_slot: SessionSlot; day_number: number | null;
  minutes: number; ended_at: string; local_date: string;
}

export interface InterviewQuestion {
  id: string; slug: string; category: string; skill_area: SkillArea; difficulty: Difficulty; title: string;
  short_answer: string; explanation: string; code_example: string | null; real_world_example: string | null;
  follow_ups: string[]; related_concepts: string[]; key_points: string[]; day_numbers: number[];
}

export interface QuestionProgress {
  question_id: string; status: "new" | "learned" | "needs_revision"; is_favorite: boolean;
  personal_answer: string | null; last_practiced_at: string | null;
}

export interface CodingChallenge {
  id: string; slug: string; category: string; skill_area: SkillArea; difficulty: Difficulty; title: string;
  description: string; example_input: string; expected_output: string; hints: string[];
  solution_explanation: string; solution_code: string | null; time_complexity: string; space_complexity: string;
}

export interface ChallengeProgress {
  challenge_id: string; status: ItemStatus; external_url: string | null; notes: string | null;
  solved_without_hints: boolean; solved_at: string | null;
}

export interface DesignExercise {
  id: string; slug: string; position: number; title: string; summary: string;
  functional_requirements: string[]; non_functional_requirements: string[]; api_design: string; database_schema: string;
  architecture: { layer: string; components: string[] }[]; scaling: string[]; caching: string[]; security: string[];
  failure_handling: string[]; tradeoffs: string[]; key_points: string[];
}

export interface DesignProgress { exercise_id: string; status: ItemStatus; notes: string | null; completed_at: string | null }

export interface Milestone {
  id: string; slug: string; position: number; title: string; description: string; target_day: number | null;
  tasks: { id: string; title: string }[];
}

export interface MilestoneProgress {
  milestone_id: string; status: ItemStatus; completed_task_ids: string[]; notes: string | null; completed_at: string | null;
}

export interface Evidence {
  id: string; milestone_id: string | null; task_id: string | null; title: string; github_url: string | null;
  demo_url: string | null; screenshot_path: string | null; explanation: string; created_at: string;
}

export interface Attempt {
  id: string; kind: "simulator" | "mock_interview" | "system_design"; skill_area: SkillArea;
  question_id: string | null; exercise_id: string | null; day_number: number | null; answer: string | null;
  key_points_total: number; key_points_covered: number; self_rating: number | null; score: number;
  notes: string | null; created_at: string;
}

export interface RevisionItem {
  id: string; source_type: "task" | "question" | "challenge" | "design"; source_id: string; title: string; link: string;
  skill_area: SkillArea; due_date: string; interval_days: number; repetitions: number; status: "active" | "resolved";
  last_reviewed_at: string | null;
}

export interface NotificationRow {
  id: string; kind: string; title: string; body: string; url: string; read_at: string | null; created_at: string;
}

export interface NoteRow { id: string; entity_type: string; entity_id: string | null; title: string | null; body: string; updated_at: string }

export const SKILL_LABELS: Record<SkillArea, string> = {
  javascript_typescript: "JavaScript & TypeScript",
  react_next: "React & Next.js",
  backend: "Node / Express / NestJS",
  databases: "Databases",
  oop_solid: "OOP & SOLID",
  dsa: "DSA",
  system_design: "System Design",
  project: "Project",
  communication: "Communication",
};

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
