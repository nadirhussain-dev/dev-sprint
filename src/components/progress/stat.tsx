import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stat({ label, value, hint, icon: Icon, className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-lg border bg-card p-4", className)}>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">{Icon ? <Icon className="h-3.5 w-3.5" /> : null}{label}</span>
      <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
