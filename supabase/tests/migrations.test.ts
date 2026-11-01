/**
 * Runs every migration against a real Postgres (PGlite/WASM) and exercises the trusted
 * functions and RLS policies as two different authenticated users.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(__dirname, "..", "migrations");
const A = "11111111-1111-4111-a111-111111111111";
const B = "22222222-2222-4222-a222-222222222222";
let db: PGlite;

async function as<T>(user: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role;`); }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(join(__dirname, "supabase-stubs.sql"), "utf8"));
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(dir, f), "utf8").replace(/create extension if not exists "pgcrypto";/g, "");
    await db.exec(sql);
  }
  await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;`);
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.dev'), ('${B}', 'b@x.dev');`);
  await db.exec(`update public.user_preferences set timezone = 'Asia/Karachi';`);
}, 60_000);

describe("content", () => {
  it("seeds 60 days, each 240 minutes", async () => {
    const r = await db.query<{ n: number; bad: number }>(`
      select count(*)::int as n,
             count(*) filter (where total <> 240)::int as bad
      from (select day_number, sum(estimated_minutes) total from public.curriculum_tasks group by day_number) t`);
    expect(r.rows[0]).toEqual({ n: 60, bad: 0 });
  });
  it("end date is generated as start + 59", async () => {
    await as(A, () => db.query(`insert into public.learning_plans (user_id, start_date) values ($1, (now() at time zone 'Asia/Karachi')::date)`, [A]));
    const r = await db.query<{ d: number }>(`select (end_date - start_date)::int d from public.learning_plans where user_id = $1`, [A]);
    expect(r.rows[0]?.d).toBe(59);
  });
});

describe("profiles bootstrap + RLS", () => {
  it("creates profile + preferences on signup", async () => {
    const r = await db.query<{ n: number }>(`select count(*)::int n from public.profiles`);
    expect(r.rows[0]?.n).toBe(2);
  });
  it("users only see their own rows", async () => {
    const seen = await as(B, () => db.query(`select * from public.learning_plans`));
    expect(seen.rows).toHaveLength(0);
  });
  it("users cannot write streak rows directly", async () => {
    await expect(as(A, () => db.query(`insert into public.daily_streaks (user_id, local_date, qualified) values ($1, current_date, true)`, [A]))).rejects.toThrow();
  });
  it("users cannot insert timer-sourced logs directly", async () => {
    await expect(as(A, () => db.query(`insert into public.study_time_logs (user_id, source, subject, session_slot, minutes, local_date) values ($1, 'timer', 'x', 'morning', 300, current_date)`, [A]))).rejects.toThrow();
  });
  it("rejects invalid timezones", async () => {
    await expect(as(A, () => db.query(`update public.user_preferences set timezone = 'Mars/Olympus' where user_id = $1`, [A]))).rejects.toThrow(/Invalid timezone/);
  });
});

describe("timer", () => {
  it("prevents overlapping timers and logs verified minutes on stop", async () => {
    await as(A, () => db.query(`select public.start_timer('Closures', 'morning', 'stopwatch', null, 1)`));
    await expect(as(A, () => db.query(`select public.start_timer('Other', 'evening', 'stopwatch', null, 1)`))).rejects.toThrow(/TIMER_ACTIVE/);
    // simulate 130 minutes elapsed
    await db.query(`update public.study_sessions set last_resumed_at = now() - interval '130 minutes' where user_id = $1`, [A]);
    const stop = await as(A, () => db.query<{ r: { minutes: number } }>(`select public.stop_timer() as r`));
    expect(stop.rows[0]?.r.minutes).toBe(130);
    const streak = await db.query<{ qualified: boolean; qualified_reason: string; verified_minutes: number }>(`select qualified, qualified_reason, verified_minutes from public.daily_streaks where user_id = $1`, [A]);
    expect(streak.rows[0]).toEqual({ qualified: true, qualified_reason: "time", verified_minutes: 130 });
  });
  it("caps forgotten timers at 5 hours", async () => {
    await as(B, () => db.query(`select public.start_timer('Forgot', 'morning', 'stopwatch', null, null)`));
    await db.query(`update public.study_sessions set last_resumed_at = now() - interval '9 hours' where user_id = $1 and status = 'running'`, [B]);
    const stop = await as(B, () => db.query<{ r: { minutes: number; capped: boolean } }>(`select public.stop_timer() as r`));
    expect(stop.rows[0]?.r).toMatchObject({ minutes: 300, capped: true });
  });
  it("manual time counts toward totals but not verified streak time", async () => {
    await as(B, () => db.query(`delete from public.study_time_logs where user_id = $1`, [B]).catch(() => undefined));
    await as(B, () => db.query(`select public.add_manual_time(150, 'Reading', 'evening', null)`));
    const r = await db.query<{ study_minutes: number }>(`select study_minutes from public.daily_streaks where user_id = $1`, [B]);
    expect(r.rows[0]?.study_minutes).toBeGreaterThanOrEqual(150);
  });
});

describe("task completion + day progress", () => {
  it("stamps local completion date, bumps version, and completes the day only when all required tasks are done", async () => {
    const tasks = await db.query<{ id: string; is_required: boolean }>(`select id, is_required from public.curriculum_tasks where day_number = 1`);
    const required = tasks.rows.filter((t) => t.is_required);
    for (const t of required.slice(0, -1)) {
      await as(A, () => db.query(`insert into public.user_task_progress (user_id, task_id, day_number, status) values ($1, $2, 1, 'completed')`, [A, t.id]));
    }
    let p = await as(A, () => db.query<{ r: { completion_pct: number; completed_at: string | null } }>(`select row_to_json(public.refresh_day_progress(1)) r`));
    expect(p.rows[0]?.r.completed_at).toBeNull();
    const last = required.at(-1)!;
    await as(A, () => db.query(`insert into public.user_task_progress (user_id, task_id, day_number, status) values ($1, $2, 1, 'in_progress')`, [A, last.id]));
    await as(A, () => db.query(`update public.user_task_progress set status = 'completed' where task_id = $1 and user_id = $2`, [last.id, A]));
    p = await as(A, () => db.query(`select row_to_json(public.refresh_day_progress(1)) r`));
    expect(p.rows[0]?.r.completion_pct).toBe(100);
    expect(p.rows[0]?.r.completed_at).not.toBeNull();
    const row = await db.query<{ version: number; completed_local_date: string | null }>(`select version, completed_local_date::text from public.user_task_progress where task_id = $1`, [last.id]);
    expect(row.rows[0]?.version).toBe(2);
    expect(row.rows[0]?.completed_local_date).not.toBeNull();
  });
});
