-- DevSprint — extend the plan from 60 to 90 days (Days 61–90: AI Engineering course).
-- Existing progress is untouched; only range checks, the plan end date and today's streak window change.

alter type public.skill_area add value if not exists 'ai_engineering';

alter table public.curriculum_days drop constraint if exists curriculum_days_day_number_check;
alter table public.curriculum_days add constraint curriculum_days_day_number_check check (day_number between 1 and 90);

alter table public.project_milestones drop constraint if exists project_milestones_target_day_check;
alter table public.project_milestones add constraint project_milestones_target_day_check check (target_day between 1 and 90);

alter table public.user_task_progress drop constraint if exists user_task_progress_day_number_check;
alter table public.user_task_progress add constraint user_task_progress_day_number_check check (day_number between 1 and 90);

alter table public.user_daily_progress drop constraint if exists user_daily_progress_day_number_check;
alter table public.user_daily_progress add constraint user_daily_progress_day_number_check check (day_number between 1 and 90);

-- The plan now spans 90 calendar days: end date is start + 89.
alter table public.learning_plans drop column end_date;
alter table public.learning_plans add column end_date date generated always as (start_date + 89) stored;


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

  if v_start is not null and v_today between v_start and v_start + 89 then
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
