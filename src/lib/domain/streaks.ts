import { addDays, diffDays, type ISODate } from "./dates";

export interface StreakDay {
  local_date: ISODate;
  qualified: boolean;
  study_minutes: number;
  tasks_completed: number;
}

export interface StreakSummary {
  current: number;
  longest: number;
  todayQualified: boolean;
  /** Streak exists (from yesterday) but today isn't qualified yet. */
  atRisk: boolean;
  activeDays: number;
  qualifiedDays: number;
  /** Plan days strictly before today with no qualifying activity. Future days never count. */
  missedDays: number;
  missedDates: ISODate[];
  /** Qualified days in the last 7 days (including today), 0–7. */
  last7Qualified: number;
}

/**
 * Streaks are computed from server-written daily_streaks rows only.
 * A row is only ever written for the user's current local date, so back-filling tasks can't create history.
 */
export function computeStreaks(
  rows: StreakDay[],
  today: ISODate,
  plan?: { start: ISODate; end: ISODate },
): StreakSummary {
  const qualified = new Set(rows.filter((r) => r.qualified && r.local_date <= today).map((r) => r.local_date));
  const todayQualified = qualified.has(today);

  let current = 0;
  let cursor = todayQualified ? today : addDays(today, -1);
  while (qualified.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...qualified].sort();
  let longest = 0;
  let run = 0;
  let prev: ISODate | null = null;
  for (const d of sorted) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  const missedDates: ISODate[] = [];
  if (plan) {
    const lastPast = addDays(today, -1);
    const stop = lastPast < plan.end ? lastPast : plan.end;
    for (let d = plan.start; d <= stop; d = addDays(d, 1)) {
      if (!qualified.has(d)) missedDates.push(d);
    }
  }

  let last7Qualified = 0;
  for (let i = 0; i < 7; i++) if (qualified.has(addDays(today, -i))) last7Qualified += 1;

  return {
    current,
    longest: Math.max(longest, current),
    todayQualified,
    atRisk: !todayQualified && current > 0,
    activeDays: rows.filter((r) => r.local_date <= today && (r.study_minutes > 0 || r.tasks_completed > 0)).length,
    qualifiedDays: qualified.size,
    missedDays: missedDates.length,
    missedDates,
    last7Qualified,
  };
}
