"use client";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMinutes } from "@/lib/utils";

const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;

function Tip({ active, payload, label, fmt }: { active?: boolean; payload?: { value: number; payload: Record<string, unknown> }[]; label?: string; fmt: (p: Record<string, unknown>) => React.ReactNode }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-0.5 font-medium">{label}</p>
      {fmt(payload[0]!.payload)}
    </div>
  );
}

export function DailyStudyChart({ data, streakMin }: { data: { label: string; date: string; minutes: number; verified: number }[]; streakMin: number }) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No days elapsed yet.</p>;
  return (
    <div className="h-56 w-full" role="img" aria-label="Study minutes per plan day">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...axis} width={44} />
          <ReferenceLine y={streakMin} stroke="var(--muted-foreground)" strokeDasharray="4 4" label={{ value: "streak min", position: "insideTopRight", fontSize: 10, fill: "var(--muted-foreground)" }} />
          <Tooltip cursor={{ fill: "var(--accent)" }} content={<Tip fmt={(p) => (
            <>
              <p className="text-muted-foreground">{String(p.date)}</p>
              <p>Total {formatMinutes(Number(p.minutes))}</p>
              <p className="text-muted-foreground">Timed {formatMinutes(Number(p.verified))}</p>
            </>
          )} />} />
          <Bar dataKey="minutes" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeeklyHoursChart({ data, targetHours }: { data: { week: string; hours: number }[]; targetHours: number }) {
  return (
    <div className="h-56 w-full" role="img" aria-label="Study hours per plan week">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="week" {...axis} />
          <YAxis {...axis} width={44} />
          <ReferenceLine y={targetHours} stroke="var(--muted-foreground)" strokeDasharray="4 4" label={{ value: "weekly target", position: "insideTopRight", fontSize: 10, fill: "var(--muted-foreground)" }} />
          <Tooltip cursor={{ fill: "var(--accent)" }} content={<Tip fmt={(p) => <p>{String(p.hours)} hours</p>} />} />
          <Bar dataKey="hours" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
