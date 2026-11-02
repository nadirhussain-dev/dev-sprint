import { addDays, diffDays, formatShortDate, type ISODate } from "@/lib/domain/dates";
import { formatMinutes } from "@/lib/utils";

export interface HeatDay { local_date: string; study_minutes: number; tasks_completed: number; qualified: boolean }

function level(d: HeatDay | undefined, target: number): number {
  if (!d || (d.study_minutes === 0 && d.tasks_completed === 0)) return 0;
  if (d.qualified && d.study_minutes >= target) return 4;
  if (d.qualified) return 3;
  if (d.study_minutes >= 60 || d.tasks_completed >= 3) return 2;
  return 1;
}

/** GitHub-style contribution grid over the whole plan (weeks as columns, Sun→Sat rows). */
export function Heatmap({ start, end, today, days, targetMinutes }: { start: ISODate; end: ISODate; today: ISODate; days: HeatDay[]; targetMinutes: number }) {
  const map = new Map(days.map((d) => [d.local_date, d]));
  const startDow = new Date(`${start}T12:00:00Z`).getUTCDay();
  const gridStart = addDays(start, -startDow);
  const totalCells = Math.ceil((diffDays(gridStart, end) + 1) / 7) * 7;
  const weeks: ISODate[][] = [];
  for (let i = 0; i < totalCells; i++) {
    const date = addDays(gridStart, i);
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1]!.push(date);
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-[3px] overflow-x-auto pb-1" role="grid" aria-label="Study activity heatmap">
        {weeks.map((w, i) => (
          <div key={i} className="flex flex-col gap-[3px]" role="row">
            {w.map((date) => {
              const inPlan = date >= start && date <= end;
              const future = date > today;
              const d = map.get(date);
              const lvl = level(d, targetMinutes);
              const title = !inPlan ? "" : future ? `${formatShortDate(date)} · upcoming`
                : `${formatShortDate(date)} · ${formatMinutes(d?.study_minutes ?? 0)}, ${d?.tasks_completed ?? 0} tasks${d?.qualified ? " · streak day" : ""}`;
              return (
                <div
                  key={date}
                  role="gridcell"
                  title={title}
                  aria-label={title || undefined}
                  className={`h-3.5 w-3.5 rounded-[3px] ${!inPlan ? "opacity-0" : future ? "border border-dashed border-border" : ""} ${date === today ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
                  style={inPlan && !future ? { background: `var(--heat-${lvl})` } : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        Less {[0, 1, 2, 3, 4].map((l) => <span key={l} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: `var(--heat-${l})` }} />)} More
        <span className="ml-2">· darkest = streak day at full target</span>
      </div>
    </div>
  );
}
