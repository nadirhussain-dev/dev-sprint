import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stat({ label, value, hint, icon: Icon, className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-xl border bg-card/90 p-4 shadow-sm backdrop-blur-sm transition-transform hover:-translate-y-0.5", className)}>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">{Icon ? <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="h-3.5 w-3.5" /></span> : null}{label}</span>
      <span className="text-2xl font-bold tabular-nums tracking-tight">{value}</span>
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
