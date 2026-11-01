/**
 * Calendar dates are plain "YYYY-MM-DD" strings interpreted in the user's IANA timezone.
 * All arithmetic on them is done in UTC so DST never shifts a date.
 */
export const PLAN_LENGTH = 60;

export type ISODate = string;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(s: string): s is ISODate {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function parts(tz: string, now: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(now)) map[p.type] = p.value;
  return map;
}

/** Today's calendar date in the given timezone. */
export function todayInTz(tz: string, now: Date = new Date()): ISODate {
  const p = parts(tz, now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Local wall-clock time "HH:mm" in the given timezone. */
export function timeInTz(tz: string, now: Date = new Date()): string {
  const p = parts(tz, now);
  return `${p.hour}:${p.minute}`;
}

/** 0 = Sunday … 6 = Saturday in the given timezone. */
export function weekdayInTz(tz: string, now: Date = new Date()): number {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names.indexOf(parts(tz, now).weekday ?? "Sun");
}

export function hourInTz(tz: string, now: Date = new Date()): number {
  return Number(parts(tz, now).hour);
}

export function addDays(date: ISODate, n: number): ISODate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function endDate(start: ISODate): ISODate {
  return addDays(start, PLAN_LENGTH - 1);
}

export function dateForDay(start: ISODate, day: number): ISODate {
  return addDays(start, day - 1);
}

export type PlanPhase = "not_started" | "active" | "finished";

export interface PlanPosition {
  phase: PlanPhase;
  /** 1..60 while active; clamped to 1 before start and 60 after the end. */
  dayNumber: number;
  /** Days until start (positive) when not started. */
  daysUntilStart: number;
  /** Days elapsed including today while active (equals dayNumber). */
  daysElapsed: number;
}

export function planPosition(start: ISODate, today: ISODate): PlanPosition {
  const offset = diffDays(start, today);
  if (offset < 0) return { phase: "not_started", dayNumber: 1, daysUntilStart: -offset, daysElapsed: 0 };
  if (offset >= PLAN_LENGTH) return { phase: "finished", dayNumber: PLAN_LENGTH, daysUntilStart: 0, daysElapsed: PLAN_LENGTH };
  return { phase: "active", dayNumber: offset + 1, daysUntilStart: 0, daysElapsed: offset + 1 };
}

export function weekOfDay(day: number): number {
  return Math.ceil(day / 7);
}

export function greeting(hour: number): string {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function formatLongDate(date: ISODate): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

export function formatShortDate(date: ISODate): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
