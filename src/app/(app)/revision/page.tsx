import type { Metadata } from "next";
import { RotateCcw } from "lucide-react";
import { getAppContext } from "@/lib/data/context";
import { getRevisionDue } from "@/lib/data/progress";
import { LADDER } from "@/lib/domain/revision";
import { RevisionCard } from "@/components/revision/revision-card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Revision" };

export default async function RevisionPage() {
  const ctx = await getAppContext();
  const { due, upcoming } = await getRevisionDue(ctx);
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Revision engine</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Anything marked “Needs revision” — or answered below 60 in the simulator — comes back on a spaced schedule
          ({LADDER.join(" → ")} days). “Not yet” resets it to tomorrow; two good recalls at the long intervals retire it.
        </p>
      </header>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Due today <span className="font-mono text-muted-foreground">· {due.length}</span></h2>
        {due.length === 0
          ? <EmptyState icon={RotateCcw} title="Nothing due today" description="Your revision queue is clear. Keep marking fuzzy topics as Needs revision — this is how they stick." />
          : due.map((i) => <RevisionCard key={i.id} item={i} due />)}
      </section>
      {upcoming.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Upcoming <span className="font-mono text-muted-foreground">· {upcoming.length}</span></h2>
          {upcoming.map((i) => <RevisionCard key={i.id} item={i} due={false} />)}
        </section>
      ) : null}
    </div>
  );
}
