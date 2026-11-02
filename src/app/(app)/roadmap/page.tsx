import type { Metadata } from "next";
import Link from "next/link";
import { Check, Mic, RotateCcw } from "lucide-react";
import { getAppContext } from "@/lib/data/context";
import { getAllDayCompletion } from "@/lib/data/progress";
import { rows } from "@/lib/supabase/result";
import { addDays, formatShortDate, PLAN_LENGTH } from "@/lib/domain/dates";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { CurriculumDay } from "@/lib/types";

export const metadata: Metadata = { title: "Roadmap" };

export default async function RoadmapPage() {
  const ctx = await getAppContext();
  const [days, completion] = await Promise.all([
    ctx.supabase.from("curriculum_days").select("*").order("day_number").then(rows<CurriculumDay>),
    getAllDayCompletion(ctx),
  ]);
  const phases = new Map<number, CurriculumDay[]>();
  for (const d of days) phases.set(d.phase_number, [...(phases.get(d.phase_number) ?? []), d]);
  const today = ctx.position.phase === "active" ? ctx.position.dayNumber : ctx.position.phase === "finished" ? PLAN_LENGTH + 1 : 0;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{PLAN_LENGTH}-day roadmap</h1>
        <p className="text-sm text-muted-foreground">{formatShortDate(ctx.plan.start_date)} → {formatShortDate(ctx.plan.end_date)} · full-stack sprint, then AI Engineering · 240 minutes a day.</p>
      </header>
      {[...phases.entries()].map(([num, list]) => {
        const req = list.reduce((s, d) => s + (completion.get(d.day_number)?.requiredTotal ?? 0), 0);
        const done = list.reduce((s, d) => s + (completion.get(d.day_number)?.requiredDone ?? 0), 0);
        const phasePct = req ? Math.round((done / req) * 100) : 0;
        return (
          <section key={num} aria-labelledby={`phase-${num}`}>
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] text-muted-foreground">PHASE {num} · DAYS {list[0]?.day_number}–{list.at(-1)?.day_number}</p>
                <h2 id={`phase-${num}`} className="text-base font-semibold">{list[0]?.phase_title}</h2>
              </div>
              <div className="w-32"><Progress value={phasePct} label={`Phase ${num} progress`} /><p className="mt-1 text-right font-mono text-[11px] text-muted-foreground">{phasePct}%</p></div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((d) => {
                const c = completion.get(d.day_number)!;
                const complete = c.requiredTotal > 0 && c.requiredDone === c.requiredTotal;
                const isToday = d.day_number === today;
                const past = d.day_number < today;
                const p = c.requiredTotal ? Math.round((c.requiredDone / c.requiredTotal) * 100) : 0;
                return (
                  <Link key={d.id} href={`/roadmap/day/${d.day_number}`}
                    className={cn("group flex flex-col gap-2 rounded-lg border bg-card p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md", isToday && "border-primary ring-2 ring-primary/40")}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-muted-foreground">DAY {d.day_number} · {formatShortDate(addDays(ctx.plan.start_date, d.day_number - 1))}</span>
                      {complete ? <Check className="h-4 w-4 text-success" aria-label="Completed" /> : isToday ? <Badge variant="solid">Today</Badge> : past && p < 100 ? <Badge variant={c.anyActivity ? "outline" : "danger"}>{c.anyActivity ? `${p}%` : "Missed"}</Badge> : null}
                    </div>
                    <p className="text-sm font-medium leading-snug">{d.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{d.topics.join(" · ")}</p>
                    <div className="mt-auto flex items-center gap-2">
                      {d.is_mock_interview ? <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Mic className="h-3 w-3" />Mock</span> : null}
                      {d.is_revision ? <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><RotateCcw className="h-3 w-3" />Revision</span> : null}
                      <Progress value={p} className="ml-auto h-1 w-16" label={`Day ${d.day_number} progress`} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
