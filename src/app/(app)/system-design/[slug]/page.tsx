import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext } from "@/lib/data/context";
import { one } from "@/lib/supabase/result";
import { ArchitectureDiagram } from "@/components/design/architecture-diagram";
import { DesignWorkspace } from "@/components/design/design-workspace";
import { CodeBlock } from "@/components/ui/code-block";
import type { DesignExercise, DesignProgress } from "@/lib/types";

export const metadata: Metadata = { title: "System design" };

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="mb-1.5 text-sm font-semibold">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </section>
  );
}

export default async function DesignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getAppContext();
  const ex = await ctx.supabase.from("system_design_exercises").select("*").eq("slug", slug).maybeSingle().then(one<DesignExercise>);
  if (!ex) notFound();
  const progress = await ctx.supabase.from("user_system_design_progress").select("*").eq("exercise_id", ex.id).maybeSingle().then(one<DesignProgress>);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/system-design" className="text-sm text-muted-foreground hover:text-foreground">← System design</Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{ex.title}</h1>
        <p className="text-sm text-muted-foreground">{ex.summary}</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <details className="rounded-lg border bg-card p-4" open={progress?.status === "completed"}>
            <summary className="cursor-pointer text-sm font-semibold">Reference design <span className="font-normal text-muted-foreground">— try it yourself before opening</span></summary>
            <div className="mt-4 flex flex-col gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <List title="Functional requirements" items={ex.functional_requirements} />
                <List title="Non-functional requirements" items={ex.non_functional_requirements} />
              </div>
              <section><h3 className="mb-1.5 text-sm font-semibold">API design</h3><CodeBlock code={ex.api_design} /></section>
              <section><h3 className="mb-1.5 text-sm font-semibold">Database schema</h3><CodeBlock code={ex.database_schema} /></section>
              <section><h3 className="mb-2 text-sm font-semibold">Architecture</h3><ArchitectureDiagram layers={ex.architecture} /></section>
              <div className="grid gap-5 sm:grid-cols-2">
                <List title="Scaling" items={ex.scaling} />
                <List title="Caching" items={ex.caching} />
                <List title="Security" items={ex.security} />
                <List title="Failure handling" items={ex.failure_handling} />
              </div>
              <List title="Trade-offs" items={ex.tradeoffs} />
            </div>
          </details>
        </div>
        <DesignWorkspace exercise={ex} progress={progress} />
      </div>
    </div>
  );
}
