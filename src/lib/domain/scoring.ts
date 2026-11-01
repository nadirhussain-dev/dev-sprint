/**
 * Self-assessment score for a simulator answer or mock interview round.
 * 80% comes from which rubric key points the answer actually covered, 20% from the
 * self-rated clarity/confidence. With no rubric, the self rating is all we have.
 */
export function scoreAttempt(covered: number, total: number, selfRating: number): number {
  const rating = Math.min(5, Math.max(1, Math.round(selfRating)));
  const ratingPart = ((rating - 1) / 4) * 100;
  if (total <= 0) return Math.round(ratingPart);
  const coverage = Math.min(1, Math.max(0, covered / total));
  return Math.round(coverage * 80 + ratingPart * 0.2);
}

export const SELF_RATING_LABELS: Record<number, string> = {
  1: "Couldn't answer",
  2: "Vague / partly wrong",
  3: "Correct but hesitant",
  4: "Clear and correct",
  5: "Interview-ready, with examples",
};
