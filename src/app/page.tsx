import Link from "next/link";
import { ArrowRight, CalendarCheck, Flame, Gauge, ListChecks, Mic, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { phases as corePhases } from "@content/curriculum";
import { aiPhases } from "@content/ai-engineering";

const phases = [...corePhases, ...aiPhases];

const features = [
  { icon: ListChecks, title: "90 days, fully planned", body: "60 days of full-stack, then 30 days of AI Engineering. Morning theory, evening practice, 240 minutes a day." },
  { icon: Flame, title: "Honest streaks", body: "Evaluated in your timezone from server-side records. No back-filled streaks, no fake progress." },
  { icon: Mic, title: "Interview simulator", body: "Random questions from topics you've finished. Answer, then score yourself against a rubric." },
  { icon: Gauge, title: "Evidence-based readiness", body: "Checking tasks builds coverage. Only assessments, solved challenges and project evidence build readiness." },
  { icon: Network, title: "System design studio", body: "Ten classic designs with requirements, APIs, schemas, scaling and trade-offs." },
  { icon: CalendarCheck, title: "Revision engine", body: "Anything marked Needs Revision comes back on a spaced schedule until it sticks." },
];

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <Button asChild variant="outline" size="sm"><Link href="/login">Sign in</Link></Button>
      </header>

      <section className="py-16 sm:py-24">
        <p className="mb-4 font-mono text-xs text-muted-foreground">FULL-STACK → AI ENGINEERING · 90 DAYS · 4 HOURS/DAY</p>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Show up every day. <span className="text-energy">Level up for real.</span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted-foreground">
          DevSprint tells you exactly what to study today, tracks every hour, and measures readiness by what you can
          demonstrate — not by how many boxes you ticked.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg"><Link href="/login">Start your sprint <ArrowRight /></Link></Button>
        </div>
      </section>

      <section className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="bg-card p-5">
            <f.icon className="mb-3 h-4 w-4" />
            <h2 className="text-sm font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="py-16">
        <h2 className="mb-4 text-sm font-semibold">The {phases.length} phases</h2>
        <ol className="divide-y rounded-lg border">
          {phases.map((p) => (
            <li key={p.number} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">{String(p.number).padStart(2, "0")}</span>
                {p.title}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                Days {p.days[0]?.day}–{p.days.at(-1)?.day}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <footer className="mt-auto border-t py-6 text-xs text-muted-foreground">
        Readiness scores are an internal preparation indicator and don&apos;t guarantee interview outcomes.
      </footer>
    </main>
  );
}
