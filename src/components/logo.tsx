export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <span aria-hidden className="grid h-6 w-6 place-items-center rounded-md bg-primary font-mono text-[11px] text-primary-foreground">60</span>
      {compact ? null : <span className="text-sm">DevSprint 60</span>}
    </span>
  );
}
