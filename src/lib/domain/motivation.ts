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
  "Understanding one concept deeply beats memorizing twenty answers.",
  "Your consistency is your competitive advantage. Let's go!",
  "Explain it out loud. If you can teach it, you know it.",
  "Small wins stack up fast. Grab the first task and build momentum.",
  "You don't need to feel ready. Start the timer and readiness follows.",
];

const ai = [
  "AI Engineering mode: build it, measure it, ship it.",
  "Every great AI feature starts with a solid backend. You already have one.",
  "Prompt, test, evaluate, repeat. That's the job — and you're doing it.",
];

export function motivationalMessage(ctx: MotivationContext): string {
  if (ctx.phase === "not_started") return "Your journey starts soon. Skim Day 1 now so you hit the ground running!";
  if (ctx.phase === "finished") return "You finished all 90 days — full-stack AND AI Engineering. Review your readiness report and pick your next challenge.";
  if (ctx.atRisk) return `Don't break the chain — ${ctx.current} day${ctx.current === 1 ? "" : "s"} on the line. One focused session keeps it alive!`;
  if (ctx.missedYesterday && ctx.current === 0) return "Welcome back! Every expert was once rusty. Start with one small task — momentum does the rest.";
  if (ctx.todayQualified) {
    if (ctx.current >= 30) return `${ctx.current} days straight. You're unstoppable!`;
    if (ctx.current >= 7) return `${ctx.current}-day streak. That's real commitment — keep the fire going!`;
    if (ctx.current >= 3) return `${ctx.current}-day streak! You're building serious momentum.`;
    return "Today's minimum is done! Push for a bonus task, or rest and come back strong tomorrow.";
  }
  if (ctx.dayNumber === 1) return "Day 1. The hardest part is starting — and you just did. Let's go!";
  if (ctx.dayNumber === 30) return "Day 30 — a third of the way there. You're becoming a stronger engineer!";
  if (ctx.dayNumber >= 57 && ctx.dayNumber <= 60) return "Final simulation week. Treat every session like the real interview!";
  if (ctx.dayNumber === 61) return "Level up: AI Engineering starts today. Your full-stack skills are your superpower here.";
  if (ctx.dayNumber >= 86) return "Final stretch of AI Engineering. Ship the capstone — you're almost there!";
  if (ctx.dayNumber > 60) return ai[ctx.dayNumber % ai.length] ?? ai[0]!;
  return general[ctx.dayNumber % general.length] ?? general[0]!;
}

export function streakMilestone(current: number): string | null {
  const marks: Record<number, string> = {
    3: "3-day streak! You're building momentum.",
    7: "7 days of commitment. Keep the fire going!",
    14: "Two weeks without breaking the chain!",
    30: "30 days straight. You're becoming a stronger engineer!",
    45: "45 days. Halfway through the whole journey!",
    60: "60 days straight. Full-stack sprint conquered!",
    75: "75 days. The AI finish line is in sight!",
    90: "90 for 90. Every single day. Legendary.",
  };
  return marks[current] ?? null;
}
