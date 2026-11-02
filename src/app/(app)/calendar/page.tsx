import type { Metadata } from "next";
import Link from "next/link";
import { Flame, Mic } from "lucide-react";
import { getAppContext } from "@/lib/data/context";
import { getAllDayCompletion, getStreaks } from "@/lib/data/progress";
import { rows } from "@/lib/supabase/result";
import { addDays, diffDays, type ISODate, PLAN_LENGTH } from "@/lib/domain/dates";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatMinutes } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendar" };

function monthsBetween(start: ISODate, end: ISODate): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  let y = Number(start.slice(0, 4)), m = Number(start.slice(5, 7));
  const ey = Number(end.slice(0, 4)), em = Number(end.slice(5, 7));
  while (y < ey || (y === ey && m <= em)) { out.push({ year: y, month: m }); m += 1; if (m > 12) { m = 1; y += 1; } }
  return out;
}

export default async function CalendarPage() {
  const ctx = await getAppContext();
  const [completion, streaks, days] = await Promise.all([
    getAllDayCompletion(ctx),
    getStreaks(ctx),
    ctx.supabase.from("curriculum_days").select("day_number, title, is_mock_interview").order("day_number").then(rows<{ day_number: number; title: string; is_mock_interview: boolean }>),
  ]);
  const byDate = new Map(streaks.rows.map((r) => [r.local_date, r]));
  const dayInfo = new Map(days.map((d) => [d.day_number, d]));
  const missed = new Set(streaks.summary.missedDates);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Preparation calendar</h1>
        <p className="text-sm text-muted-foreground">Every plan day mapped to your calendar. Days are evaluated in {ctx.tz}.</p>
      </header>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-primary" />All required tasks done</span>
        <span className="flex items-center gap-1.5"><Flame className="h-3 w-3" />Streak day earned</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-danger/50 bg-danger/10" />Missed</span>
        <span className="flex items-center gap-1.5"><Mic className="h-3 w-3" />Mock interview</span>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {monthsBetween(ctx.plan.start_date, ctx.plan.end_date).map(({ year, month }) => {
          const first = `${year}-${String(month).padStart(2, "0")}-01`;
          const lead = new Date(`${first}T12:00:00Z`).getUTCDay();
          const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
          const cells: (ISODate | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i))];
          return (
            <Card key={first}>
              <CardContent className="pt-5">
                <h2 className="mb-3 text-sm font-semibold">{new Date(`${first}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</h2>
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="pb-1">{d}</div>)}
                  {cells.map((date, i) => {
                    if (!date) return <div key={`e${i}`} />;
                    const planDay = diffDays(ctx.plan.start_date, date) + 1;
                    const inPlan = planDay >= 1 && planDay <= PLAN_LENGTH;
                    const c = inPlan ? completion.get(planDay) : undefined;
                    const complete = c && c.requiredTotal > 0 && c.requiredDone === c.requiredTotal;
                    const s = byDate.get(date);
                    const isToday = date === ctx.today;
                    const info = inPlan ? dayInfo.get(planDay) : undefined;
                    const body = (
                      <div className={cn(
                        "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md border text-xs",
                        !inPlan && "border-transparent text-muted-foreground/40",
                        complete && "border-primary bg-primary text-primary-foreground",
                        inPlan && !complete && missed.has(date) && "border-danger/40 bg-danger/5",
                        isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                      )}
                        title={inPlan ? `Day ${planDay}: ${info?.title ?? ""}${s ? ` · ${formatMinutes(s.study_minutes)}` : ""}` : undefined}>
                        <span className="font-medium">{Number(date.slice(8))}</span>
                        {inPlan ? (
                          <span className="flex items-center gap-0.5 font-mono text-[9px] opacity-80">
                            D{planDay}{s?.qualified ? <Flame className="h-2.5 w-2.5" /> : null}{info?.is_mock_interview ? <Mic className="h-2.5 w-2.5" /> : null}
                          </span>
                        ) : null}
                      </div>
                    );
                    return inPlan ? <Link key={date} href={`/roadmap/day/${planDay}`} aria-label={`Day ${planDay}, ${date}`}>{body}</Link> : <div key={date}>{body}</div>;
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
