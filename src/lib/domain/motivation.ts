export interface MotivationContext {
  current: number;
  longest: number;
  todayQualified: boolean;
  atRisk: boolean;
  missedYesterday: boolean;
  dayNumber: number;
  phase: "not_started" | "active" | "finished";
  overallPct: number;
}

const general = [
  "One more day of consistent learning. Your future self will thank you.",
  "Understanding one concept deeply is better than memorizing twenty answers.",
  "Your consistency is your competitive advantage.",
  "Explain it out loud. If you can teach it, you know it.",
];

export function motivationalMessage(ctx: MotivationContext): string {
  if (ctx.phase === "not_started") return "Your sprint hasn't started yet. Skim Day 1 so you can hit the ground running.";
  if (ctx.phase === "finished") return "You finished the 60 days. Review your readiness report and pick your next learning path.";
  if (ctx.atRisk) return `Don't break the chain — ${ctx.current} day${ctx.current === 1 ? "" : "s"} on the line. Small improvements every day create strong engineers.`;
  if (ctx.missedYesterday && ctx.current === 0) return "Yesterday slipped. That's fine — today is the only day you can win. Start with the first morning task.";
  if (ctx.todayQualified) {
    if (ctx.current >= 30) return `${ctx.current} days straight. Your consistency is your competitive advantage.`;
    if (ctx.current >= 7) return `${ctx.current}-day streak. 7+ days of commitment — keep moving!`;
    if (ctx.current >= 3) return `${ctx.current}-day streak! You're building consistency.`;
    return "Today's minimum is done. Anything more is a bonus — or rest and come back strong tomorrow.";
  }
  if (ctx.dayNumber === 30) return "Halfway there! You're becoming a stronger engineer.";
  if (ctx.dayNumber >= 57) return "Final simulation week. Treat every session like the real interview.";
  return general[ctx.dayNumber % general.length] ?? general[0]!;
}

export function streakMilestone(current: number): string | null {
  const marks: Record<number, string> = {
    3: "3-day streak! You're building consistency.",
    7: "7 days of commitment. Keep moving!",
    14: "Two weeks without breaking the chain.",
    30: "Halfway there! You're becoming a stronger engineer.",
    45: "45 days. The finish line is in sight.",
    60: "60 for 60. Every single day.",
  };
  return marks[current] ?? null;
}
