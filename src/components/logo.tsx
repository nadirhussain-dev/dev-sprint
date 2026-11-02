import { Zap } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2 font-bold tracking-tight">
      <span aria-hidden className="bg-energy shadow-energy grid h-7 w-7 place-items-center rounded-lg text-energy-fg">
        <Zap className="h-4 w-4 fill-current" />
      </span>
      {compact ? null : <span className="text-energy text-base">DevSprint</span>}
    </span>
  );
}
