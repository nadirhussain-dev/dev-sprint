import { describe, expect, it } from "vitest";
import { addDays, diffDays, endDate, planPosition, todayInTz, timeInTz, isISODate } from "./dates";
import { computeStreaks, type StreakDay } from "./streaks";
import { computeReadiness } from "./readiness";
import { scheduleNext } from "./revision";
import { scoreAttempt } from "./scoring";
import { dueReminders, type ReminderPrefs } from "./reminders";
import { phases, allDays } from "@content/curriculum";
import { generateTasks, splitMinutes } from "@content/tasks";

const day = (local_date: string, qualified: boolean): StreakDay => ({ local_date, qualified, study_minutes: qualified ? 130 : 10, tasks_completed: 1 });

describe("dates", () => {
  it("end date is start + 59 (60 calendar days)", () => {
    expect(endDate("2026-11-01")).toBe("2026-12-30");
    expect(diffDays("2026-11-01", endDate("2026-11-01")) + 1).toBe(60);
  });
  it("handles starting mid-month and crossing year/leap boundaries", () => {
    expect(endDate("2027-12-15")).toBe("2028-02-12");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("DST transitions don't shift dates", () => {
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  });
  it("computes plan position", () => {
    expect(planPosition("2026-11-10", "2026-11-01")).toMatchObject({ phase: "not_started", daysUntilStart: 9 });
    expect(planPosition("2026-11-01", "2026-11-12")).toMatchObject({ phase: "active", dayNumber: 12 });
    expect(planPosition("2026-11-01", "2026-12-30")).toMatchObject({ phase: "active", dayNumber: 60 });
    expect(planPosition("2026-11-01", "2026-12-31")).toMatchObject({ phase: "finished", dayNumber: 60 });
  });
  it("today depends on timezone (after-midnight case)", () => {
    const instant = new Date("2026-11-02T07:30:00Z"); // 23:30 Nov 1 in LA, 12:30 Nov 2 in Karachi
    expect(todayInTz("America/Los_Angeles", instant)).toBe("2026-11-01");
    expect(todayInTz("Asia/Karachi", instant)).toBe("2026-11-02");
    expect(timeInTz("Asia/Karachi", instant)).toBe("12:30");
  });
  it("validates ISO dates", () => {
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("2026-02-28")).toBe(true);
  });
});

describe("streaks", () => {
  const plan = { start: "2026-11-01", end: "2026-12-30" };
  it("no activity → zeros, nothing missed on day 1", () => {
    const s = computeStreaks([], "2026-11-01", plan);
    expect(s).toMatchObject({ current: 0, longest: 0, missedDays: 0, atRisk: false });
  });
  it("counts consecutive days ending today", () => {
    const s = computeStreaks([day("2026-11-01", true), day("2026-11-02", true), day("2026-11-03", true)], "2026-11-03", plan);
    expect(s.current).toBe(3);
    expect(s.todayQualified).toBe(true);
  });
  it("streak from yesterday is kept but at risk until today qualifies", () => {
    const s = computeStreaks([day("2026-11-01", true), day("2026-11-02", true)], "2026-11-03", plan);
    expect(s).toMatchObject({ current: 2, atRisk: true, todayQualified: false });
  });
  it("a missed day breaks the streak but longest is preserved", () => {
    const rows = [day("2026-11-01", true), day("2026-11-02", true), day("2026-11-03", true), day("2026-11-05", true)];
    const s = computeStreaks(rows, "2026-11-05", plan);
    expect(s.current).toBe(1);
    expect(s.longest).toBe(3);
    expect(s.missedDates).toEqual(["2026-11-04"]);
  });
  it("non-qualifying activity doesn't count; future rows ignored", () => {
    const rows = [day("2026-11-01", false), day("2026-11-02", true), day("2026-11-09", true)];
    const s = computeStreaks(rows, "2026-11-02", plan);
    expect(s.current).toBe(1);
    expect(s.missedDays).toBe(1);
    expect(s.qualifiedDays).toBe(1);
  });
  it("future plan days are never missed", () => {
    const s = computeStreaks([], "2026-11-05", plan);
    expect(s.missedDays).toBe(4);
  });
});

describe("readiness", () => {
  it("checking tasks alone gives no readiness", () => {
    const r = computeReadiness({ attempts: [], challenges: [], milestones: [], coverage: { javascript_typescript: 95, react_next: 90 } });
    expect(r.overall).toBe(0);
    expect(r.band).toBe("Not enough evidence");
    expect(r.recommendations.some((x) => x.includes("demonstrated"))).toBe(true);
  });
  it("one great answer is discounted by confidence", () => {
    const r = computeReadiness({ attempts: [{ kind: "simulator", skill_area: "react_next", score: 100, created_at: "2026-11-02" }], challenges: [], milestones: [], coverage: {} });
    const react = r.areas.find((a) => a.area === "react_next")!;
    expect(react.score).toBe(20);
    expect(react.rawAverage).toBe(100);
  });
  it("project milestones need evidence for full credit", () => {
    const r = computeReadiness({ attempts: [], challenges: [], coverage: {}, milestones: [{ taskFraction: 1, hasEvidence: false }, { taskFraction: 1, hasEvidence: true }] });
    expect(r.areas.find((a) => a.area === "project")!.score).toBe(75);
  });
});

describe("revision + scoring + reminders", () => {
  it("spaced repetition ladder", () => {
    expect(scheduleNext(0, "good", "2026-11-01")).toMatchObject({ intervalDays: 3, dueDate: "2026-11-04" });
    expect(scheduleNext(2, "again", "2026-11-01")).toMatchObject({ repetitions: 0, dueDate: "2026-11-02" });
    expect(scheduleNext(2, "good", "2026-11-01").resolved).toBe(false);
    expect(scheduleNext(3, "good", "2026-11-01").resolved).toBe(true);
  });
  it("scores answers from rubric coverage", () => {
    expect(scoreAttempt(4, 4, 5)).toBe(100);
    expect(scoreAttempt(2, 4, 3)).toBe(50);
    expect(scoreAttempt(0, 4, 1)).toBe(0);
  });
  it("reminders respect windows and state", () => {
    const prefs: ReminderPrefs = {
      morning_reminder_enabled: true, morning_reminder_time: "07:00:00",
      evening_reminder_enabled: true, evening_reminder_time: "19:00:00",
      incomplete_reminder_enabled: true, incomplete_reminder_time: "21:00:00",
      streak_warning_enabled: true, streak_warning_time: "22:00:00",
      weekly_revision_enabled: true, weekly_revision_dow: 0, weekly_revision_time: "10:00:00",
      mock_reminder_enabled: true, mock_reminder_time: "08:00:00",
    };
    const base = { localDate: "2026-11-01", weekday: 0, planActive: true, dayNumber: 1, dayTitle: "X", requiredRemaining: 3, todayQualified: false, currentStreak: 2, isMockDay: false, revisionDue: 0 };
    expect(dueReminders(prefs, { ...base, localTime: "07:10" }, 15).map((r) => r.kind)).toEqual(["morning"]);
    expect(dueReminders(prefs, { ...base, localTime: "22:05" }).map((r) => r.kind)).toEqual(["morning", "evening", "incomplete", "streak_warning", "weekly_revision"]);
    expect(dueReminders(prefs, { ...base, localTime: "22:05", todayQualified: true, requiredRemaining: 0 }).map((r) => r.kind)).not.toContain("streak_warning");
  });
});

describe("curriculum", () => {
  it("has exactly 60 sequential days across 9 phases", () => {
    expect(phases).toHaveLength(9);
    expect(allDays.map((d) => d.day)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
  });
  it("every day totals 240 minutes: 120 morning + 120 evening", () => {
    for (const d of allDays) {
      const t = generateTasks(d);
      expect(t.filter((x) => x.session === "morning").reduce((s, x) => s + x.minutes, 0)).toBe(120);
      expect(t.filter((x) => x.session === "evening").reduce((s, x) => s + x.minutes, 0)).toBe(120);
    }
  });
  it("splits minutes in 5-minute steps", () => {
    expect(splitMinutes(105, 4)).toEqual([30, 25, 25, 25]);
    expect(splitMinutes(105, 8).reduce((a, b) => a + b, 0)).toBe(105);
  });
});
