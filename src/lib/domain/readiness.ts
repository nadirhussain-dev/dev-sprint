/**
 * Interview readiness — an internal preparation indicator, NOT a prediction of interview outcomes.
 *
 * Principle: checking tasks off builds coverage, but readiness only rises with evidence —
 * scored self-assessments, solved challenges, mock interviews, and project milestones
 * backed by GitHub links/screenshots. 90% of tasks checked with no assessments = ~0% readiness.
 */
export type ReadinessArea =
  | "javascript_typescript" | "react_next" | "backend" | "databases"
  | "oop_solid" | "dsa" | "system_design" | "project" | "mock";

export const AREA_META: Record<ReadinessArea, { label: string; weight: number; evidence: string }> = {
  javascript_typescript: { label: "JavaScript & TypeScript", weight: 15, evidence: "Simulator answers" },
  react_next: { label: "React & Next.js", weight: 15, evidence: "Simulator answers" },
  backend: { label: "Node.js, Express & NestJS", weight: 15, evidence: "Simulator answers" },
  databases: { label: "Databases", weight: 10, evidence: "Simulator answers" },
  oop_solid: { label: "OOP & SOLID", weight: 8, evidence: "Simulator answers" },
  dsa: { label: "DSA", weight: 12, evidence: "Solved challenges + simulator" },
  system_design: { label: "System Design", weight: 12, evidence: "Design reviews + simulator" },
  project: { label: "Practical project", weight: 8, evidence: "Milestones with evidence" },
  mock: { label: "Mock interviews", weight: 5, evidence: "Scored mock interviews" },
};

export const AREAS = Object.keys(AREA_META) as ReadinessArea[];

/** Attempts needed before an area's score counts at full confidence. */
export const FULL_CONFIDENCE_ATTEMPTS = 5;
export const FULL_CONFIDENCE_MOCKS = 3;

export interface AttemptInput {
  kind: "simulator" | "mock_interview" | "system_design";
  skill_area: string;
  score: number;
  created_at: string;
}
export interface ChallengeInput { difficulty: "beginner" | "intermediate" | "advanced"; skill_area: string; solved: boolean; withoutHints: boolean }
export interface MilestoneInput { taskFraction: number; hasEvidence: boolean }
export interface ReadinessInput {
  attempts: AttemptInput[];
  challenges: ChallengeInput[];
  milestones: MilestoneInput[];
  /** Curriculum task completion % per area — shown as coverage, never as readiness. */
  coverage: Partial<Record<ReadinessArea, number>>;
}

export interface AreaScore {
  area: ReadinessArea;
  label: string;
  weight: number;
  score: number;        // 0–100, evidence-based
  rawAverage: number;   // average before confidence
  confidence: number;   // 0–1
  evidenceCount: number;
  coverage: number;     // 0–100 task completion
  explanation: string;
}

export interface ReadinessResult {
  overall: number;
  band: "Not enough evidence" | "Early" | "Developing" | "Solid" | "Strong";
  areas: AreaScore[];
  strong: AreaScore[];
  weak: AreaScore[];
  recommendations: string[];
}

/** Recency-weighted mean of the latest 10 scores (newest weight 1.0, decaying 10% per step). */
export function recentWeightedMean(scores: { score: number; created_at: string }[]): number {
  const latest = [...scores].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10);
  if (latest.length === 0) return 0;
  let num = 0, den = 0;
  latest.forEach((s, i) => { const w = Math.pow(0.9, i); num += s.score * w; den += w; });
  return num / den;
}

const DIFF_WEIGHT = { beginner: 1, intermediate: 2, advanced: 3 } as const;

function band(overall: number, totalEvidence: number): ReadinessResult["band"] {
  if (totalEvidence === 0) return "Not enough evidence";
  if (overall < 30) return "Early";
  if (overall < 55) return "Developing";
  if (overall < 75) return "Solid";
  return "Strong";
}

export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const byArea = (area: string, kinds: AttemptInput["kind"][]) =>
    input.attempts.filter((a) => a.skill_area === area && kinds.includes(a.kind));

  const areas: AreaScore[] = AREAS.map((area) => {
    const meta = AREA_META[area];
    const coverage = Math.round(input.coverage[area] ?? 0);
    let rawAverage = 0, confidence = 0, evidenceCount = 0, score = 0, explanation = "";

    if (area === "dsa") {
      const pool = input.challenges.filter((c) => c.skill_area === "dsa");
      const total = pool.reduce((s, c) => s + DIFF_WEIGHT[c.difficulty], 0);
      const earned = pool.filter((c) => c.solved).reduce((s, c) => s + DIFF_WEIGHT[c.difficulty] * (c.withoutHints ? 1 : 0.7), 0);
      const challengeScore = total > 0 ? (earned / total) * 100 : 0;
      const sims = byArea("dsa", ["simulator", "mock_interview"]);
      const simAvg = recentWeightedMean(sims);
      const simConf = Math.min(1, sims.length / FULL_CONFIDENCE_ATTEMPTS);
      evidenceCount = pool.filter((c) => c.solved).length + sims.length;
      rawAverage = sims.length ? 0.7 * challengeScore + 0.3 * simAvg : challengeScore;
      confidence = evidenceCount === 0 ? 0 : 1;
      score = 0.7 * challengeScore + 0.3 * simAvg * simConf;
      explanation = `70% difficulty-weighted DSA challenges solved (${Math.round(challengeScore)}%, hint-assisted solves count 70%) + 30% DSA simulator answers.`;
    } else if (area === "project") {
      const ms = input.milestones;
      const per = ms.map((m) => Math.min(1, m.taskFraction) * 50 + (m.hasEvidence ? 50 : 0));
      rawAverage = per.length ? per.reduce((a, b) => a + b, 0) / per.length : 0;
      evidenceCount = ms.filter((m) => m.hasEvidence).length;
      confidence = 1;
      score = rawAverage;
      explanation = "Each milestone: up to 50% for completed tasks + 50% only when evidence (GitHub link/screenshot + explanation) is attached.";
    } else if (area === "mock") {
      const mocks = input.attempts.filter((a) => a.kind === "mock_interview");
      rawAverage = recentWeightedMean(mocks);
      evidenceCount = mocks.length;
      confidence = Math.min(1, mocks.length / FULL_CONFIDENCE_MOCKS);
      score = rawAverage * confidence;
      explanation = `Recency-weighted average of mock interview scores; full weight after ${FULL_CONFIDENCE_MOCKS} mocks.`;
    } else {
      const kinds: AttemptInput["kind"][] = area === "system_design" ? ["simulator", "system_design", "mock_interview"] : ["simulator", "mock_interview"];
      const atts = byArea(area, kinds);
      rawAverage = recentWeightedMean(atts);
      evidenceCount = atts.length;
      confidence = Math.min(1, atts.length / FULL_CONFIDENCE_ATTEMPTS);
      score = rawAverage * confidence;
      explanation = `Recency-weighted average of your last 10 scored answers × confidence (${atts.length}/${FULL_CONFIDENCE_ATTEMPTS} attempts).`;
    }

    return {
      area, label: meta.label, weight: meta.weight,
      score: Math.round(score), rawAverage: Math.round(rawAverage),
      confidence: Math.round(confidence * 100) / 100, evidenceCount, coverage, explanation,
    };
  });

  const totalWeight = areas.reduce((s, a) => s + a.weight, 0);
  const overall = Math.round(areas.reduce((s, a) => s + a.score * a.weight, 0) / totalWeight);
  const totalEvidence = areas.reduce((s, a) => s + a.evidenceCount, 0);

  const strong = areas.filter((a) => a.score >= 70).sort((a, b) => b.score - a.score);
  const weak = areas.filter((a) => a.score < 50).sort((a, b) => a.score - b.score);

  const recommendations: string[] = [];
  for (const a of weak.slice(0, 4)) {
    if (a.area === "project") recommendations.push("Attach a GitHub link and short explanation to your completed project milestones.");
    else if (a.area === "mock") recommendations.push("Record a scored mock interview (Simulator → Mock interview mode).");
    else if (a.area === "dsa") recommendations.push("Solve two DSA challenges without hints this week.");
    else if (a.evidenceCount < FULL_CONFIDENCE_ATTEMPTS) recommendations.push(`Answer ${FULL_CONFIDENCE_ATTEMPTS - a.evidenceCount} more ${a.label} questions in the Interview Simulator.`);
    else recommendations.push(`Revise ${a.label}: your recent answers average ${a.rawAverage}%. Re-study the key points you missed.`);
  }
  for (const a of areas) {
    if (a.coverage >= 80 && a.score < 40 && a.area !== "project" && a.area !== "mock") {
      recommendations.push(`${a.label}: ${a.coverage}% of tasks done but only ${a.score}% demonstrated — test yourself before moving on.`);
    }
  }

  return { overall, band: band(overall, totalEvidence), areas, strong, weak, recommendations: [...new Set(recommendations)].slice(0, 6) };
}

/** Maps a curriculum skill_area to its readiness area. */
export function readinessAreaFor(skill: string): ReadinessArea {
  if (skill === "communication") return "mock";
  return (AREAS as string[]).includes(skill) ? (skill as ReadinessArea) : "javascript_typescript";
}
