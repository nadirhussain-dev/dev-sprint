import type { Metadata } from "next";
import Link from "next/link";
import { Mic } from "lucide-react";
import { getAppContext } from "@/lib/data/context";
import { rows } from "@/lib/supabase/result";
import { QuestionBrowser } from "@/components/questions/question-browser";
import { Button } from "@/components/ui/button";
import type { InterviewQuestion, QuestionProgress } from "@/lib/types";

export const metadata: Metadata = { title: "Question bank" };

const ORDER = ["JavaScript", "Advanced JavaScript", "OOP", "SOLID", "TypeScript", "React", "Next.js", "Node.js", "Express.js", "NestJS", "MongoDB", "PostgreSQL", "Redis", "System Design", "DSA", "Software Architecture"];

export default async function QuestionsPage() {
  const ctx = await getAppContext();
  const [questions, progress] = await Promise.all([
    ctx.supabase.from("interview_questions").select("id, title, category, difficulty, short_answer, related_concepts").then(rows<InterviewQuestion>),
    ctx.supabase.from("user_question_progress").select("*").then(rows<QuestionProgress>),
  ]);
  questions.sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category));
  const learned = progress.filter((p) => p.status === "learned").length;
  const revise = progress.filter((p) => p.status === "needs_revision").length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Interview question bank</h1>
          <p className="text-sm text-muted-foreground">{questions.length} questions · {learned} learned · {revise} to revise</p>
        </div>
        <Button asChild><Link href="/simulator"><Mic />Practice in simulator</Link></Button>
      </header>
      <QuestionBrowser questions={questions} progress={Object.fromEntries(progress.map((p) => [p.question_id, p]))} categories={ORDER.filter((c) => questions.some((q) => q.category === c))} />
    </div>
  );
}
