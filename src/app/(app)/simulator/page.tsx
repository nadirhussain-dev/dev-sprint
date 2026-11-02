import type { Metadata } from "next";
import { getAppContext } from "@/lib/data/context";
import { rows } from "@/lib/supabase/result";
import { PLAN_LENGTH } from "@/lib/domain/dates";
import { Simulator } from "@/components/simulator/simulator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SKILL_LABELS, type Attempt, type InterviewQuestion, type SkillArea } from "@/lib/types";

export const metadata: Metadata = { title: "Interview simulator" };

export default async function SimulatorPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { day } = await searchParams;
  const focusDay = day && /^\d+$/.test(day) && Number(day) >= 1 && Number(day) <= PLAN_LENGTH ? Number(day) : null;
  const ctx = await getAppContext();
  const [questions, completed, attempts, mockDays] = await Promise.all([
    ctx.supabase.from("interview_questions").select("*").then(rows<InterviewQuestion>),
    ctx.supabase.from("user_task_progress").select("day_number").eq("status", "completed").then(rows<{ day_number: number }>),
    ctx.supabase.from("assessment_attempts").select("*").order("created_at", { ascending: false }).limit(12).then(rows<Attempt>),
    ctx.supabase.from("curriculum_days").select("day_number, title, skill_area").eq("is_mock_interview", true).order("day_number").then(rows<{ day_number: number; title: string; skill_area: SkillArea }>),
  ]);
  const studied = [...new Set(completed.map((c) => c.day_number))];
  const titles = new Map(questions.map((q) => [q.id, q.title]));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Interview simulator</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">Random questions from topics you&apos;ve studied. Answer first, then score yourself against the rubric. These scores — not task checkboxes — drive your readiness.</p>
      </header>
      <Simulator questions={questions} studiedDays={studied} focusDay={focusDay} mockDays={mockDays} />
      <Card>
        <CardHeader><CardTitle>Recent attempts</CardTitle></CardHeader>
        <CardContent>
          {attempts.length === 0 ? <p className="text-sm text-muted-foreground">No attempts yet.</p> : (
            <ul className="divide-y text-sm">
              {attempts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <span className="w-10 font-mono font-semibold tabular-nums">{a.score}</span>
                  <span className="min-w-0 flex-1 truncate">{a.question_id ? titles.get(a.question_id) : a.kind === "mock_interview" ? `Mock interview${a.day_number ? ` · Day ${a.day_number}` : ""}` : "System design review"}</span>
                  <Badge variant="outline" className="hidden sm:inline-flex">{SKILL_LABELS[a.skill_area]}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
