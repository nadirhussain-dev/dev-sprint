import type { Metadata } from "next";
import { getAppContext } from "@/lib/data/context";
import { rows } from "@/lib/supabase/result";
import { addDays, formatShortDate, PLAN_LENGTH } from "@/lib/domain/dates";
import { MilestoneCard } from "@/components/projects/milestone-card";
import { Progress } from "@/components/ui/progress";
import type { Evidence, Milestone, MilestoneProgress } from "@/lib/types";

export const metadata: Metadata = { title: "Project" };

const STACK = ["Next.js", "React", "TypeScript", "NestJS", "PostgreSQL", "Prisma", "Redis", "Socket.IO", "AWS S3", "Docker"];

export default async function ProjectsPage() {
  const ctx = await getAppContext();
  const [milestones, progress, evidence] = await Promise.all([
    ctx.supabase.from("project_milestones").select("*").order("position").then(rows<Milestone>),
    ctx.supabase.from("user_project_progress").select("*").then(rows<MilestoneProgress>),
    ctx.supabase.from("project_evidence").select("*").not("milestone_id", "is", null).order("created_at", { ascending: false }).then(rows<Evidence>),
  ]);
  const p = new Map(progress.map((x) => [x.milestone_id, x]));
  const totalTasks = milestones.reduce((s, m) => s + m.tasks.length, 0);
  const doneTasks = progress.reduce((s, x) => s + x.completed_task_ids.length, 0);
  const withEvidence = new Set(evidence.map((e) => e.milestone_id)).size;
  const currentDay = ctx.position.phase === "active" ? ctx.position.dayNumber : ctx.position.phase === "finished" ? 61 : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div>
          <p className="font-mono text-[11px] text-muted-foreground">PORTFOLIO PROJECT</p>
          <h1 className="text-2xl font-semibold tracking-tight">Service Booking & Management Platform</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">The project you&apos;ll walk interviewers through. Build it alongside the curriculum and attach evidence as you go.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">{STACK.map((s) => <span key={s} className="rounded-md border px-2 py-0.5 text-xs">{s}</span>)}</div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Progress value={totalTasks ? (doneTasks / totalTasks) * 100 : 0} className="max-w-xs" label="Project tasks complete" />
          <span className="font-mono text-xs text-muted-foreground">{doneTasks}/{totalTasks} tasks · {withEvidence}/{milestones.length} milestones with evidence</span>
        </div>
      </header>
      <div className="flex flex-col gap-2">
        {[...milestones].sort((a, b) => (a.target_day ?? 0) - (b.target_day ?? 0) || a.position - b.position).map((m) => {
          const pr = p.get(m.id) ?? null;
          return (
            <MilestoneCard
              key={m.id}
              milestone={m}
              progress={pr}
              evidence={evidence.filter((e) => e.milestone_id === m.id)}
              targetDate={formatShortDate(addDays(ctx.plan.start_date, (m.target_day ?? PLAN_LENGTH) - 1))}
              overdue={(m.target_day ?? 61) < currentDay && pr?.status !== "completed"}
            />
          );
        })}
      </div>
    </div>
  );
}
