import type { ISODate } from "./dates";

export type ReminderKind = "morning" | "evening" | "incomplete" | "streak_warning" | "weekly_revision" | "mock_interview";

export interface ReminderPrefs {
  morning_reminder_enabled: boolean; morning_reminder_time: string;
  evening_reminder_enabled: boolean; evening_reminder_time: string;
  incomplete_reminder_enabled: boolean; incomplete_reminder_time: string;
  streak_warning_enabled: boolean; streak_warning_time: string;
  weekly_revision_enabled: boolean; weekly_revision_dow: number; weekly_revision_time: string;
  mock_reminder_enabled: boolean; mock_reminder_time: string;
}

export interface ReminderState {
  localDate: ISODate;
  localTime: string;          // "HH:mm"
  weekday: number;            // 0 = Sunday
  planActive: boolean;
  dayNumber: number;
  dayTitle: string;
  requiredRemaining: number;
  todayQualified: boolean;
  currentStreak: number;
  isMockDay: boolean;
  revisionDue: number;
}

export interface DueReminder {
  kind: ReminderKind;
  title: string;
  body: string;
  url: string;
  dedupeKey: string;
  time: string;
}

const toMinutes = (hm: string): number => {
  const [h, m] = hm.slice(0, 5).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/**
 * Reminders whose scheduled time has passed today.
 * windowMinutes limits to reminders scheduled within the last N minutes (push cron);
 * omit it for in-app catch-up (anything earlier today).
 */
export function dueReminders(prefs: ReminderPrefs, s: ReminderState, windowMinutes?: number): DueReminder[] {
  const now = toMinutes(s.localTime);
  const inWindow = (hm: string) => {
    const t = toMinutes(hm);
    if (t > now) return false;
    return windowMinutes === undefined ? true : now - t < windowMinutes;
  };
  const out: DueReminder[] = [];
  const add = (kind: ReminderKind, time: string, title: string, body: string, url: string) =>
    out.push({ kind, title, body, url, time: time.slice(0, 5), dedupeKey: `${kind}:${s.localDate}` });

  if (s.planActive) {
    const dayUrl = `/roadmap/day/${s.dayNumber}`;
    if (prefs.morning_reminder_enabled && inWindow(prefs.morning_reminder_time))
      add("morning", prefs.morning_reminder_time, `Day ${s.dayNumber}: morning session`, `Today: ${s.dayTitle}. Start with the concepts.`, dayUrl);
    if (prefs.evening_reminder_enabled && inWindow(prefs.evening_reminder_time))
      add("evening", prefs.evening_reminder_time, "Evening practice time", "Coding, interview questions and practical work for today.", dayUrl);
    if (prefs.incomplete_reminder_enabled && s.requiredRemaining > 0 && inWindow(prefs.incomplete_reminder_time))
      add("incomplete", prefs.incomplete_reminder_time, `${s.requiredRemaining} required task${s.requiredRemaining === 1 ? "" : "s"} left`, `Finish Day ${s.dayNumber} before midnight.`, dayUrl);
    if (prefs.mock_reminder_enabled && s.isMockDay && inWindow(prefs.mock_reminder_time))
      add("mock_interview", prefs.mock_reminder_time, "Mock interview day", "Block uninterrupted time and record your scores in the Simulator.", "/simulator");
  }
  if (prefs.streak_warning_enabled && !s.todayQualified && s.currentStreak > 0 && inWindow(prefs.streak_warning_time))
    add("streak_warning", prefs.streak_warning_time, `Your ${s.currentStreak}-day streak is at risk`, "Finish today's required tasks or log 2 hours of timed study.", "/dashboard");
  if (prefs.weekly_revision_enabled && s.weekday === prefs.weekly_revision_dow && inWindow(prefs.weekly_revision_time))
    add("weekly_revision", prefs.weekly_revision_time, "Weekly revision", s.revisionDue > 0 ? `${s.revisionDue} item${s.revisionDue === 1 ? "" : "s"} due for revision.` : "Review this week's weak topics.", "/revision");
  return out;
}
