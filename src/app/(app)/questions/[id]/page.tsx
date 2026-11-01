import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext } from "@/lib/data/context";
import { one } from "@/lib/supabase/result";
import { QuestionPractice } from "@/components/questions/question-practice";
import { Badge } from "@/components/ui/badge";
import type { InterviewQuestion, QuestionProgress } from "@/lib/types";

export const metadata: Metadata = { title: "Question" };

export default async function QuestionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ practice?: string }> }) {
  const [{ id }, { practice }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getAppContext();
  const [question, progress] = await Promise.all([
    ctx.supabase.from("interview_questions").select("*").eq("id", id).maybeSingle().then(one<InterviewQuestion>),
    ctx.supabase.from("user_question_progress").select("*").eq("question_id", id).maybeSingle().then(one<QuestionProgress>),
  ]);
  if (!question) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/questions" className="text-sm text-muted-foreground hover:text-foreground">← Question bank</Link>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{question.category}</Badge>
          <Badge variant="outline" className="capitalize">{question.difficulty}</Badge>
          {question.day_numbers.map((d) => <Link key={d} href={`/roadmap/day/${d}`}><Badge>Day {d}</Badge></Link>)}
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{question.title}</h1>
      </header>
      <QuestionPractice question={question} progress={progress} startHidden={practice === "1" || !progress || progress.status !== "learned"} />
    </div>
  );
}
