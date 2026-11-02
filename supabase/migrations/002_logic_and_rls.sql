-- DevSprint 60 — trusted business logic + Row Level Security
--
-- Streak days, daily progress snapshots, and timer-based (verified) study time are written
-- ONLY by the SECURITY DEFINER functions below. They read the clock from the database
-- (now()) and the user's timezone from user_preferences, so the browser cannot forge them.

-- ---------------------------------------------------------------------------
-- New-user bootstrap
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, '')) on conflict do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Timezone helpers
-- ---------------------------------------------------------------------------
create or replace function public.user_tz(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select timezone from public.user_preferences where user_id = p_user), 'UTC');
$$;

create or replace function public.user_today(p_user uuid) returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone public.user_tz(p_user))::date;
$$;

-- Validate IANA timezone names on write.
create or replace function public.validate_timezone() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end $$;
create trigger user_preferences_tz before insert or update of timezone on public.user_preferences
for each row execute function public.validate_timezone();

-- Stamp the local calendar date when a task is completed (or clear it on undo).
create or replace function public.stamp_task_completion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    new.completed_at := now();
    new.completed_local_date := public.user_today(new.user_id);
  elsif new.status <> 'completed' then
    new.completed_at := null;
    new.completed_local_date := null;
  end if;
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
  end if;
  return new;
end $$;
create trigger user_task_progress_stamp before insert or update on public.user_task_progress
for each row execute function public.stamp_task_completion();

-- ---------------------------------------------------------------------------
-- Daily progress snapshot for one curriculum day
-- ---------------------------------------------------------------------------
create or replace function public.refresh_day_progress(p_day int) returns public.user_daily_progress
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_req_total int; v_req_done int; v_all_total int; v_all_done int; v_pct int;
  result public.user_daily_progress;
begin
  if uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;

  select count(*) filter (where t.is_required),
         count(*) filter (where t.is_required and p.status = 'completed'),
         count(*),
         count(*) filter (where p.status = 'completed')
    into v_req_total, v_req_done, v_all_total, v_all_done
  from public.curriculum_tasks t
  left join public.user_task_progress p on p.task_id = t.id and p.user_id = uid
  where t.day_number = p_day;

  -- custom tasks count toward the overall %, never toward "required"
  select v_all_total + count(*), v_all_done + count(*) filter (where status = 'completed')
    into v_all_total, v_all_done
  from public.user_task_progress
  where user_id = uid and task_id is null and day_number = p_day;

  v_pct := case when v_req_total = 0 then 0 else round(100.0 * v_req_done / v_req_total) end;

  insert into public.user_daily_progress as d
    (user_id, day_number, required_total, required_completed, all_total, all_completed, completion_pct, completed_at, updated_at)
  values (uid, p_day, v_req_total, v_req_done, v_all_total, v_all_done, v_pct,
          case when v_req_total > 0 and v_req_done = v_req_total then now() end, now())
  on conflict (user_id, day_number) do update set
    required_total = excluded.required_total,
    required_completed = excluded.required_completed,
    all_total = excluded.all_total,
    all_completed = excluded.all_completed,
    completion_pct = excluded.completion_pct,
    completed_at = case
      when excluded.required_total > 0 and excluded.required_completed = excluded.required_total
        then coalesce(d.completed_at, now())
      else null end,
    updated_at = now()
  returning * into result;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- Streak evaluation for TODAY (user's timezone). Past dates are never rewritten,
-- so finishing an old day's tasks later can't retroactively create a streak.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_today() returns public.daily_streaks
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_today date;
  v_start date;
  v_day int;
  v_min int;
  v_total int; v_verified int; v_done_today int;
  v_req_total int := 0; v_req_done int := 0;
  v_qualified boolean;
  v_reason text;
  result public.daily_streaks;
begin
  if uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  v_today := public.user_today(uid);
  select start_date into v_start from public.learning_plans where user_id = uid;
  select streak_min_minutes into v_min from public.user_preferences where user_id = uid;
  v_min := coalesce(v_min, 120);

  if v_start is not null and v_today between v_start and v_start + 59 then
    v_day := (v_today - v_start) + 1;
    select count(*) filter (where t.is_required),
           count(*) filter (where t.is_required and p.status = 'completed')
      into v_req_total, v_req_done
    from public.curriculum_tasks t
    left join public.user_task_progress p on p.task_id = t.id and p.user_id = uid
    where t.day_number = v_day;
  end if;

  select coalesce(sum(minutes), 0), coalesce(sum(minutes) filter (where source = 'timer'), 0)
    into v_total, v_verified
  from public.study_time_logs where user_id = uid and local_date = v_today;

  select count(*) into v_done_today
  from public.user_task_progress where user_id = uid and completed_local_date = v_today;

  v_qualified := v_verified >= v_min or (v_req_total > 0 and v_req_done = v_req_total);
  v_reason := case
    when v_req_total > 0 and v_req_done = v_req_total and v_verified >= v_min then 'tasks_and_time'
    when v_req_total > 0 and v_req_done = v_req_total then 'tasks'
    when v_verified >= v_min then 'time'
    else null end;

  insert into public.daily_streaks as s
    (user_id, local_date, day_number, study_minutes, verified_minutes, tasks_completed,
     required_total, required_completed, qualified, qualified_reason, qualified_at, updated_at)
  values (uid, v_today, v_day, v_total, v_verified, v_done_today, v_req_total, v_req_done,
          v_qualified, v_reason, case when v_qualified then now() end, now())
  on conflict (user_id, local_date) do update set
    day_number = excluded.day_number,
    study_minutes = excluded.study_minutes,
    verified_minutes = excluded.verified_minutes,
    tasks_completed = excluded.tasks_completed,
    required_total = excluded.required_total,
    required_completed = excluded.required_completed,
    qualified = excluded.qualified,
    qualified_reason = excluded.qualified_reason,
    qualified_at = case when excluded.qualified then coalesce(s.qualified_at, now()) else null end,
    updated_at = now()
  returning * into result;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- Study timer (server clock, one active timer per user across all devices)
-- ---------------------------------------------------------------------------
create or replace function public.timer_elapsed(s public.study_sessions) returns int
language sql stable as $$
  select s.accumulated_seconds + case
    when s.status = 'running' then greatest(0, floor(extract(epoch from (now() - coalesce(s.last_resumed_at, s.started_at)))))::int
    else 0 end;
$$;

create or replace function public.start_timer(
  p_subject text, p_slot public.session_slot, p_mode public.timer_mode, p_target_seconds int, p_day int
) returns public.study_sessions
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); result public.study_sessions;
begin
  if uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if exists (select 1 from public.study_sessions where user_id = uid and status <> 'stopped') then
    raise exception 'TIMER_ACTIVE' using errcode = 'P0001';
  end if;
  if p_mode = 'countdown' and (p_target_seconds is null or p_target_seconds < 60 or p_target_seconds > 18000) then
    raise exception 'Countdown must be between 1 minute and 5 hours' using errcode = '22023';
  end if;
  insert into public.study_sessions (user_id, mode, target_seconds, subject, session_slot, day_number, status, started_at, last_resumed_at)
  values (uid, p_mode, case when p_mode = 'countdown' then p_target_seconds end,
          left(trim(p_subject), 120), p_slot, p_day, 'running', now(), now())
  returning * into result;
  return result;
end $$;

create or replace function public.pause_timer() returns public.study_sessions
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); result public.study_sessions;
begin
  update public.study_sessions s
     set accumulated_seconds = public.timer_elapsed(s), status = 'paused', last_resumed_at = null
   where user_id = uid and status = 'running'
  returning * into result;
  if result.id is null then raise exception 'No running timer' using errcode = 'P0002'; end if;
  return result;
end $$;

create or replace function public.resume_timer() returns public.study_sessions
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); result public.study_sessions;
begin
  update public.study_sessions set status = 'running', last_resumed_at = now()
   where user_id = uid and status = 'paused'
  returning * into result;
  if result.id is null then raise exception 'No paused timer' using errcode = 'P0002'; end if;
  return result;
end $$;

-- Returns json: { minutes, seconds, capped }
create or replace function public.stop_timer() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s public.study_sessions;
  v_seconds int;
  v_capped boolean := false;
  v_minutes int;
begin
  select * into s from public.study_sessions where user_id = uid and status <> 'stopped' for update;
  if s.id is null then raise exception 'No active timer' using errcode = 'P0002'; end if;

  v_seconds := public.timer_elapsed(s);
  if s.mode = 'countdown' and v_seconds > s.target_seconds then v_seconds := s.target_seconds; end if;
  -- a forgotten timer can't log more than 5 hours in one session
  if v_seconds > 18000 then v_seconds := 18000; v_capped := true; end if;

  update public.study_sessions
     set status = 'stopped', accumulated_seconds = v_seconds, ended_at = now(), last_resumed_at = null
   where id = s.id;

  v_minutes := floor(v_seconds / 60.0);
  if v_minutes >= 1 then
    insert into public.study_time_logs (user_id, session_id, source, subject, session_slot, day_number, minutes, started_at, ended_at, local_date)
    values (uid, s.id, 'timer', s.subject, s.session_slot, s.day_number, v_minutes, s.started_at, now(), public.user_today(uid));
  end if;
  perform public.refresh_today();
  return jsonb_build_object('minutes', v_minutes, 'seconds', v_seconds, 'capped', v_capped);
end $$;

-- Manual entries are allowed (confirmed in the UI) but are not "verified" for streaks.
create or replace function public.add_manual_time(
  p_minutes int, p_subject text, p_slot public.session_slot, p_day int
) returns public.study_time_logs
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); result public.study_time_logs;
begin
  if uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if p_minutes < 1 or p_minutes > 480 then raise exception 'Minutes must be 1–480' using errcode = '22023'; end if;
  insert into public.study_time_logs (user_id, source, subject, session_slot, day_number, minutes, ended_at, local_date)
  values (uid, 'manual', left(trim(p_subject), 120), p_slot, p_day, p_minutes, now(), public.user_today(uid))
  returning * into result;
  perform public.refresh_today();
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.learning_plans enable row level security;
alter table public.curriculum_days enable row level security;
alter table public.curriculum_tasks enable row level security;
alter table public.interview_questions enable row level security;
alter table public.coding_challenges enable row level security;
alter table public.system_design_exercises enable row level security;
alter table public.project_milestones enable row level security;
alter table public.user_task_progress enable row level security;
alter table public.user_daily_progress enable row level security;
alter table public.study_sessions enable row level security;
alter table public.study_time_logs enable row level security;
alter table public.daily_streaks enable row level security;
alter table public.user_question_progress enable row level security;
alter table public.user_challenge_progress enable row level security;
alter table public.user_system_design_progress enable row level security;
alter table public.user_project_progress enable row level security;
alter table public.project_evidence enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.revision_items enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.user_notes enable row level security;

-- Shared content: readable by any signed-in user, writable by nobody (seeded via migrations).
do $$
declare t text;
begin
  foreach t in array array['curriculum_days','curriculum_tasks','interview_questions','coding_challenges','system_design_exercises','project_milestones'] loop
    execute format('create policy "%s readable" on public.%I for select to authenticated using (true)', t, t);
  end loop;
end $$;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Fully user-owned tables: full CRUD on own rows only.
do $$
declare t text;
begin
  foreach t in array array[
    'user_preferences','learning_plans','user_task_progress','user_question_progress','user_challenge_progress',
    'user_system_design_progress','user_project_progress','project_evidence','assessment_attempts',
    'revision_items','push_subscriptions','user_notes'
  ] loop
    execute format('create policy "own rows select" on public.%I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy "own rows insert" on public.%I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy "own rows update" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "own rows delete" on public.%I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

-- Read-only to the user; written by trusted functions / server jobs.
create policy "own rows select" on public.user_daily_progress for select to authenticated using (user_id = auth.uid());
create policy "own rows select" on public.daily_streaks for select to authenticated using (user_id = auth.uid());
create policy "own rows select" on public.study_sessions for select to authenticated using (user_id = auth.uid());
create policy "own rows select" on public.study_time_logs for select to authenticated using (user_id = auth.uid());
create policy "own manual delete" on public.study_time_logs for delete to authenticated using (user_id = auth.uid() and source = 'manual');
create policy "own rows select" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "own rows mark read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows select" on public.weekly_reports for select to authenticated using (user_id = auth.uid());
create policy "own rows upsert" on public.weekly_reports for insert to authenticated with check (user_id = auth.uid());
create policy "own rows update" on public.weekly_reports for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- In-app reminders are created for the signed-in user only.
create or replace function public.create_in_app_notification(p_kind text, p_title text, p_body text, p_url text, p_dedupe text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, url, dedupe_key)
  values (auth.uid(), p_kind, p_title, p_body, p_url, p_dedupe)
  on conflict (user_id, dedupe_key) do nothing;
$$;

-- Function grants
revoke all on function public.refresh_today() from public, anon;
revoke all on function public.refresh_day_progress(int) from public, anon;
revoke all on function public.start_timer(text, public.session_slot, public.timer_mode, int, int) from public, anon;
revoke all on function public.pause_timer() from public, anon;
revoke all on function public.resume_timer() from public, anon;
revoke all on function public.stop_timer() from public, anon;
revoke all on function public.add_manual_time(int, text, public.session_slot, int) from public, anon;
revoke all on function public.create_in_app_notification(text, text, text, text, text) from public, anon;
grant execute on function public.refresh_today(), public.refresh_day_progress(int), public.pause_timer(),
  public.resume_timer(), public.stop_timer() to authenticated;
grant execute on function public.start_timer(text, public.session_slot, public.timer_mode, int, int) to authenticated;
grant execute on function public.add_manual_time(int, text, public.session_slot, int) to authenticated;
grant execute on function public.create_in_app_notification(text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for project-evidence screenshots (<uid>/<file>)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "evidence own read" on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "evidence own write" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "evidence own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime: keep timer + notifications in sync across devices
alter publication supabase_realtime add table public.study_sessions, public.notifications;
