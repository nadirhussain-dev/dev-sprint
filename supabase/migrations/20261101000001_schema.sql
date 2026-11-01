-- DevSprint 60 — core schema
-- Timestamps are stored in UTC (timestamptz). Calendar-day attribution ("local_date")
-- is computed in the database from each user's IANA timezone in user_preferences.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.task_status as enum ('not_started', 'in_progress', 'completed', 'skipped', 'needs_revision');
create type public.session_slot as enum ('morning', 'evening');
create type public.skill_area as enum (
  'javascript_typescript', 'react_next', 'backend', 'databases',
  'oop_solid', 'dsa', 'system_design', 'project', 'communication'
);
create type public.difficulty as enum ('beginner', 'intermediate', 'advanced');
create type public.timer_status as enum ('running', 'paused', 'stopped');
create type public.timer_mode as enum ('stopwatch', 'countdown');
create type public.item_status as enum ('not_started', 'in_progress', 'completed', 'needs_revision');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  experience_level text not null default 'mid' check (experience_level in ('junior', 'mid', 'senior')),
  target_level text not null default 'senior' check (target_level in ('mid', 'senior')),
  target_position text not null default 'Senior Full-Stack Engineer',
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  timezone text not null default 'UTC',
  daily_target_minutes int not null default 240 check (daily_target_minutes between 30 and 960),
  morning_minutes int not null default 120 check (morning_minutes between 0 and 480),
  evening_minutes int not null default 120 check (evening_minutes between 0 and 480),
  streak_min_minutes int not null default 120 check (streak_min_minutes between 15 and 600),
  morning_reminder_enabled boolean not null default true,
  morning_reminder_time time not null default '07:00',
  evening_reminder_enabled boolean not null default true,
  evening_reminder_time time not null default '19:00',
  incomplete_reminder_enabled boolean not null default true,
  incomplete_reminder_time time not null default '21:00',
  streak_warning_enabled boolean not null default true,
  streak_warning_time time not null default '22:00',
  weekly_revision_enabled boolean not null default true,
  weekly_revision_dow int not null default 0 check (weekly_revision_dow between 0 and 6),
  weekly_revision_time time not null default '10:00',
  mock_reminder_enabled boolean not null default true,
  mock_reminder_time time not null default '08:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A plan fixes the 60-day window. End date is always start + 59 days (60 calendar days).
create table public.learning_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  start_date date not null,
  end_date date generated always as (start_date + 59) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Shared curriculum content (globally readable, not user-writable)
-- ---------------------------------------------------------------------------
create table public.curriculum_days (
  id uuid primary key default gen_random_uuid(),
  day_number int not null unique check (day_number between 1 and 60),
  week_number int not null,
  phase_number int not null,
  phase_title text not null,
  title text not null,
  skill_area public.skill_area not null,
  morning_focus text not null,
  evening_focus text not null,
  topics text[] not null default '{}',
  objectives text[] not null default '{}',
  interview_questions text[] not null default '{}',
  coding_assignments text[] not null default '{}',
  practical_outcomes text[] not null default '{}',
  is_mock_interview boolean not null default false,
  is_revision boolean not null default false
);

create table public.curriculum_tasks (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.curriculum_days (id) on delete cascade,
  day_number int not null,
  session public.session_slot not null,
  position int not null,
  title text not null,
  description text,
  task_type text not null check (task_type in ('learn', 'practice', 'questions', 'assignment', 'mock', 'recap')),
  estimated_minutes int not null check (estimated_minutes > 0),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  is_required boolean not null default true,
  skill_area public.skill_area not null,
  unique (day_number, session, position)
);
create index curriculum_tasks_day_idx on public.curriculum_tasks (day_number);

create table public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null,
  skill_area public.skill_area not null,
  difficulty public.difficulty not null,
  title text not null,
  short_answer text not null,
  explanation text not null,
  code_example text,
  real_world_example text,
  follow_ups text[] not null default '{}',
  related_concepts text[] not null default '{}',
  key_points text[] not null default '{}',
  day_numbers int[] not null default '{}'
);
create index interview_questions_category_idx on public.interview_questions (category);

create table public.coding_challenges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null,
  skill_area public.skill_area not null default 'dsa',
  difficulty public.difficulty not null,
  title text not null,
  description text not null,
  example_input text not null,
  expected_output text not null,
  hints text[] not null default '{}',
  solution_explanation text not null,
  solution_code text,
  time_complexity text not null,
  space_complexity text not null
);

create table public.system_design_exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  position int not null,
  title text not null,
  summary text not null,
  functional_requirements text[] not null,
  non_functional_requirements text[] not null,
  api_design text not null,
  database_schema text not null,
  architecture jsonb not null,
  scaling text[] not null,
  caching text[] not null,
  security text[] not null,
  failure_handling text[] not null,
  tradeoffs text[] not null,
  key_points text[] not null default '{}'
);

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  position int not null,
  title text not null,
  description text not null,
  target_day int check (target_day between 1 and 60),
  tasks jsonb not null default '[]'::jsonb
);

-- ---------------------------------------------------------------------------
-- User progress
-- ---------------------------------------------------------------------------
create table public.user_task_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid references public.curriculum_tasks (id) on delete cascade,
  day_number int not null check (day_number between 1 and 60),
  custom_title text,
  custom_minutes int,
  custom_session public.session_slot,
  status public.task_status not null default 'not_started',
  notes text,
  mistakes text,
  resources jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  completed_local_date date,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_or_custom check (task_id is not null or custom_title is not null)
);
create unique index user_task_progress_unique on public.user_task_progress (user_id, task_id) where task_id is not null;
create index user_task_progress_user_day on public.user_task_progress (user_id, day_number);

create table public.user_daily_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day_number int not null check (day_number between 1 and 60),
  required_total int not null default 0,
  required_completed int not null default 0,
  all_total int not null default 0,
  all_completed int not null default 0,
  completion_pct int not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, day_number)
);

-- Active/past timers. Only one non-stopped timer per user (prevents overlap across devices).
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode public.timer_mode not null default 'stopwatch',
  target_seconds int,
  subject text not null,
  session_slot public.session_slot not null,
  day_number int,
  status public.timer_status not null default 'running',
  started_at timestamptz not null default now(),
  last_resumed_at timestamptz,
  accumulated_seconds int not null default 0,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index study_sessions_one_active on public.study_sessions (user_id) where status <> 'stopped';

create table public.study_time_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid references public.study_sessions (id) on delete set null,
  source text not null check (source in ('timer', 'manual')),
  subject text not null,
  session_slot public.session_slot not null,
  day_number int,
  minutes int not null check (minutes > 0 and minutes <= 600),
  started_at timestamptz,
  ended_at timestamptz not null default now(),
  local_date date not null,
  created_at timestamptz not null default now()
);
create index study_time_logs_user_date on public.study_time_logs (user_id, local_date);

-- One row per user per local calendar date. Written only by refresh_today().
create table public.daily_streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  day_number int,
  study_minutes int not null default 0,
  verified_minutes int not null default 0,
  tasks_completed int not null default 0,
  required_total int not null default 0,
  required_completed int not null default 0,
  qualified boolean not null default false,
  qualified_reason text,
  qualified_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, local_date)
);

create table public.user_question_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.interview_questions (id) on delete cascade,
  status text not null default 'new' check (status in ('new', 'learned', 'needs_revision')),
  is_favorite boolean not null default false,
  personal_answer text,
  last_practiced_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create table public.user_challenge_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.coding_challenges (id) on delete cascade,
  status public.item_status not null default 'not_started',
  external_url text,
  notes text,
  solved_without_hints boolean not null default false,
  solved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, challenge_id)
);

create table public.user_system_design_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.system_design_exercises (id) on delete cascade,
  status public.item_status not null default 'not_started',
  notes text,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);

create table public.user_project_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  milestone_id uuid not null references public.project_milestones (id) on delete cascade,
  status public.item_status not null default 'not_started',
  completed_task_ids text[] not null default '{}',
  notes text,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, milestone_id)
);

-- Evidence of practical work (GitHub link, screenshot, explanation)
create table public.project_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  milestone_id uuid references public.project_milestones (id) on delete cascade,
  task_id uuid references public.curriculum_tasks (id) on delete cascade,
  title text not null,
  github_url text,
  demo_url text,
  screenshot_path text,
  explanation text not null,
  created_at timestamptz not null default now(),
  constraint evidence_target check (milestone_id is not null or task_id is not null)
);
create index project_evidence_user on public.project_evidence (user_id);

-- Self-assessment results: simulator answers, mock interviews, design reviews.
create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('simulator', 'mock_interview', 'system_design')),
  skill_area public.skill_area not null,
  question_id uuid references public.interview_questions (id) on delete set null,
  exercise_id uuid references public.system_design_exercises (id) on delete set null,
  day_number int,
  answer text,
  key_points_total int not null default 0,
  key_points_covered int not null default 0,
  self_rating int check (self_rating between 1 and 5),
  score int not null check (score between 0 and 100),
  notes text,
  created_at timestamptz not null default now()
);
create index assessment_attempts_user_area on public.assessment_attempts (user_id, skill_area, created_at desc);

-- Spaced revision queue (things marked "needs revision" come back on a schedule)
create table public.revision_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type text not null check (source_type in ('task', 'question', 'challenge', 'design')),
  source_id uuid not null,
  title text not null,
  link text not null,
  skill_area public.skill_area not null,
  due_date date not null,
  interval_days int not null default 1,
  repetitions int not null default 0,
  status text not null default 'active' check (status in ('active', 'resolved')),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);
create index revision_items_due on public.revision_items (user_id, status, due_date);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  url text not null default '/dashboard',
  dedupe_key text not null,
  pushed boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user_created on public.notifications (user_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  failure_count int not null default 0,
  last_success_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_number int not null check (week_number between 1 and 9),
  week_start date not null,
  week_end date not null,
  data jsonb not null,
  generated_at timestamptz not null default now(),
  unique (user_id, week_number)
);

create table public.user_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null check (entity_type in ('day', 'task', 'question', 'challenge', 'design', 'milestone', 'general')),
  entity_id text,
  title text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_notes_entity on public.user_notes (user_id, entity_type, entity_id);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_preferences','learning_plans','user_task_progress','study_sessions',
    'user_question_progress','user_challenge_progress','user_system_design_progress',
    'user_project_progress','revision_items','user_notes'
  ] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;
