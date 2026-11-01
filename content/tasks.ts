import type { DaySpec, SkillArea } from "./types";

export interface GeneratedTask {
  session: "morning" | "evening";
  position: number;
  title: string;
  description: string;
  taskType: "learn" | "practice" | "questions" | "assignment" | "mock" | "recap";
  minutes: number;
  priority: "high" | "medium" | "low";
  required: boolean;
  skill: SkillArea;
}

/** Split `total` minutes into `n` parts in 5-minute steps, front-loading the remainder. */
export function splitMinutes(total: number, n: number): number[] {
  if (n <= 0) return [];
  const units = Math.floor(total / 5);
  const base = Math.floor(units / n);
  let extra = units - base * n;
  return Array.from({ length: n }, () => {
    const u = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    return u * 5;
  });
}

/**
 * Morning (120m): theory — one task per topic, plus a 15m written recap.
 * Evening (120m): practice — assignments, interview questions out loud, mistake review.
 * Totals always equal 240 minutes.
 */
export function generateTasks(d: DaySpec): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];
  // Mock/revision days: topics that are activities rather than concepts go to the evening.
  const theory = d.topics;
  const morningSplit = splitMinutes(105, theory.length);
  theory.forEach((topic, i) => {
    tasks.push({
      session: "morning",
      position: i + 1,
      title: d.revision || d.mock ? `Review: ${topic}` : `Learn: ${topic}`,
      description: d.revision || d.mock
        ? `Revisit ${topic}. Re-read your notes, then explain it out loud without looking.`
        : `Study ${topic}. Read the docs/source, write a minimal example, and note one gotcha.`,
      taskType: "learn",
      minutes: morningSplit[i] ?? 15,
      priority: i < 2 ? "high" : "medium",
      required: true,
      skill: d.skill,
    });
  });
  tasks.push({
    session: "morning",
    position: theory.length + 1,
    title: "Write a recap in your own words",
    description: "Summarize today's concepts in 5–10 bullet points. Mark anything fuzzy as Needs Revision.",
    taskType: "recap",
    minutes: 15,
    priority: "low",
    required: false,
    skill: d.skill,
  });

  const [a1, a2] = d.assignments;
  let pos = 1;
  if (a1) {
    tasks.push({
      session: "evening", position: pos++, title: d.mock ? `Timed: ${stripTimed(a1)}` : `Code: ${a1}`,
      description: d.mock ? "Set a countdown timer and work under interview conditions. Attach evidence when done." : "Implement it, commit it, and attach a GitHub link as evidence.",
      taskType: d.mock ? "mock" : "assignment", minutes: 45, priority: "high", required: true, skill: d.skill,
    });
  }
  if (a2) {
    tasks.push({
      session: "evening", position: pos++, title: d.mock ? `Timed: ${stripTimed(a2)}` : `Code: ${a2}`,
      description: "Implement it and note any mistakes you made along the way.",
      taskType: d.mock ? "mock" : "practice", minutes: 35, priority: "medium", required: !d.revision, skill: d.skill,
    });
  }
  tasks.push({
    session: "evening", position: pos++, title: "Answer today's interview questions out loud",
    description: "Answer each question in under 2 minutes, then check the question bank. Use the Interview Simulator to score yourself.",
    taskType: "questions", minutes: 30, priority: "high", required: true, skill: d.skill,
  });
  tasks.push({
    session: "evening", position: pos++, title: "Log mistakes and plan revision",
    description: "Write down mistakes, mark weak topics as Needs Revision, and preview tomorrow.",
    taskType: "recap", minutes: 10, priority: "low", required: false, skill: d.skill,
  });

  // If a day has <2 assignments, give the remaining evening time to questions so totals stay 240.
  const evening = tasks.filter((t) => t.session === "evening");
  const eveningTotal = evening.reduce((s, t) => s + t.minutes, 0);
  const q = evening.find((t) => t.taskType === "questions");
  if (q && eveningTotal < 120) q.minutes += 120 - eveningTotal;
  return tasks;
}

function stripTimed(s: string): string {
  return s.replace(/^Timed:\s*/i, "");
}
