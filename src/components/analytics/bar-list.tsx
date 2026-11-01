/** Labeled horizontal bars — one ink, value printed in text so identity never relies on color. */
export function BarList({ items }: { items: { label: string; value: number; detail?: string; muted?: boolean }[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((i) => (
        <li key={i.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{i.label}</span>
            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{i.detail ?? `${i.value}%`}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={i.value} aria-valuemin={0} aria-valuemax={100} aria-label={i.label}>
            <div className={`h-full rounded-full ${i.muted ? "bg-muted-foreground/50" : "bg-primary"}`} style={{ width: `${Math.max(0, Math.min(100, i.value))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
