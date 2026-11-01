"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Shuffle, Star } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { InterviewQuestion, QuestionProgress } from "@/lib/types";

type Row = Pick<InterviewQuestion, "id" | "title" | "category" | "difficulty" | "short_answer" | "related_concepts">;

export function QuestionBrowser({ questions, progress, categories }: { questions: Row[]; progress: Record<string, QuestionProgress>; categories: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return questions.filter((x) => {
      const p = progress[x.id];
      if (category !== "all" && x.category !== category) return false;
      if (difficulty !== "all" && x.difficulty !== difficulty) return false;
      if (status === "favorites" && !p?.is_favorite) return false;
      if (status !== "all" && status !== "favorites" && (p?.status ?? "new") !== status) return false;
      if (needle && !`${x.title} ${x.short_answer} ${x.related_concepts.join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [questions, progress, q, category, difficulty, status]);

  const random = () => {
    const pool = filtered.length ? filtered : questions;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) router.push(`/questions/${pick.id}?practice=1`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Search questions" placeholder="Search questions, answers, concepts…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
        <div className="grid grid-cols-3 gap-2 lg:w-[460px]">
          <NativeSelect aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All topics</option>{categories.map((c) => <option key={c}>{c}</option>)}
          </NativeSelect>
          <NativeSelect aria-label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="all">Any level</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
          </NativeSelect>
          <NativeSelect aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Any status</option><option value="new">New</option><option value="learned">Learned</option><option value="needs_revision">Needs revision</option><option value="favorites">Favorites</option>
          </NativeSelect>
        </div>
        <Button variant="outline" onClick={random}><Shuffle />Random</Button>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} of {questions.length} questions</p>
      {filtered.length === 0 ? <EmptyState icon={Search} title="No questions match" description="Try a different filter." /> : (
        <ul className="divide-y rounded-lg border bg-card">
          {filtered.map((x) => {
            const p = progress[x.id];
            return (
              <li key={x.id}>
                <Link href={`/questions/${x.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{x.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{x.category}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {p?.is_favorite ? <Star className="h-3.5 w-3.5 fill-current" aria-label="Favorite" /> : null}
                    {p?.status === "learned" ? <Badge variant="success">Learned</Badge> : p?.status === "needs_revision" ? <Badge variant="warning">Revise</Badge> : null}
                    <Badge variant="outline" className="capitalize">{x.difficulty}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
