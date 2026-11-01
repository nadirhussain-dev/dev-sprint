import { addDays, type ISODate } from "./dates";

export type RevisionOutcome = "again" | "good" | "easy";

/** Fixed spaced-repetition ladder in days. */
export const LADDER = [1, 3, 7, 14, 30] as const;

export interface RevisionSchedule {
  repetitions: number;
  intervalDays: number;
  dueDate: ISODate;
  resolved: boolean;
}

/**
 * "again" resets to tomorrow, "good" climbs one rung, "easy" climbs two.
 * An item is resolved after it's been recalled at the 14-day rung or above.
 */
export function scheduleNext(repetitions: number, outcome: RevisionOutcome, today: ISODate): RevisionSchedule {
  if (outcome === "again") return { repetitions: 0, intervalDays: 1, dueDate: addDays(today, 1), resolved: false };
  const step = outcome === "easy" ? 2 : 1;
  const nextReps = repetitions + step;
  const resolved = nextReps >= LADDER.length - 1;
  const intervalDays = LADDER[Math.min(nextReps, LADDER.length - 1)] ?? 30;
  return { repetitions: nextReps, intervalDays, dueDate: addDays(today, intervalDays), resolved };
}

export function firstDueDate(today: ISODate): ISODate {
  return addDays(today, 1);
}
