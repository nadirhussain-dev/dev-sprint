import type { Metadata } from "next";
import { getAppContext } from "@/lib/data/context";
import { rows } from "@/lib/supabase/result";
import { ChallengeCard } from "@/components/coding/challenge-card";
import { Progress } from "@/components/ui/progress";
import type { ChallengeProgress, CodingChallenge } from "@/lib/types";

export const metadata: Metadata = { title: "Coding challenges" };

const ORDER = ["JavaScript fundamentals", "Arrays", "Strings", "Objects", "Recursion", "Sorting and searching", "Two pointers", "Sliding window", "Stack and queue", "Promises", "Debounce and throttle", "React practical challenges", "Backend API challenges"];

export default async function CodingPage() {
  const ctx = await getAppContext();
  const [challenges, progress] = await Promise.all([
    ctx.supabase.from("coding_challenges").select("*").then(rows<CodingChallenge>),
    ctx.supabase.from("user_challenge_progress").select("*").then(rows<ChallengeProgress>),
  ]);
  const p = new Map(progress.map((x) => [x.challenge_id, x]));
  const solved = progress.filter((x) => x.status === "completed").length;
  const clean = progress.filter((x) => x.status === "completed" && x.solved_without_hints).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coding challenges</h1>
          <p className="text-sm text-muted-foreground">{solved}/{challenges.length} solved · {clean} without hints. Hint-free solves count fully toward DSA readiness; assisted solves count 70%.</p>
        </div>
        <Progress value={challenges.length ? (solved / challenges.length) * 100 : 0} className="max-w-md" label="Challenges solved" />
      </header>
      {ORDER.filter((cat) => challenges.some((c) => c.category === cat)).map((cat) => (
        <section key={cat} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{cat}</h2>
          {challenges.filter((c) => c.category === cat).map((c) => <ChallengeCard key={c.id} challenge={c} progress={p.get(c.id) ?? null} />)}
        </section>
      ))}
    </div>
  );
}
