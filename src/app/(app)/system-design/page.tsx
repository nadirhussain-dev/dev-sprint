import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "@/lib/data/context";
import { rows } from "@/lib/supabase/result";
import { Badge } from "@/components/ui/badge";
import type { DesignExercise, DesignProgress } from "@/lib/types";

export const metadata: Metadata = { title: "System design" };

const LABEL = { not_started: null, in_progress: "In progress", completed: "Completed", needs_revision: "Revise" } as const;

export default async function SystemDesignPage() {
  const ctx = await getAppContext();
  const [list, progress] = await Promise.all([
    ctx.supabase.from("system_design_exercises").select("id, slug, position, title, summary, architecture").order("position").then(rows<DesignExercise>),
    ctx.supabase.from("user_system_design_progress").select("*").then(rows<DesignProgress>),
  ]);
  const p = new Map(progress.map((x) => [x.exercise_id, x]));
  const done = progress.filter((x) => x.status === "completed").length;
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">System design studio</h1>
        <p className="text-sm text-muted-foreground">{done}/{list.length} completed. Design each one yourself first, then compare against the reference and score yourself.</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((d) => {
          const s = p.get(d.id)?.status ?? "not_started";
          return (
            <Link key={d.id} href={`/system-design/${d.slug}`} className="flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/30">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-muted-foreground">{String(d.position).padStart(2, "0")}</span>
                {LABEL[s] ? <Badge variant={s === "completed" ? "success" : s === "needs_revision" ? "warning" : "default"}>{LABEL[s]}</Badge> : null}
              </div>
              <h2 className="text-sm font-semibold">{d.title}</h2>
              <p className="text-xs text-muted-foreground">{d.summary}</p>
              <p className="mt-auto font-mono text-[10px] text-muted-foreground">{d.architecture.map((l) => l.layer).join(" → ")}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
