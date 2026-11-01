import { ArrowDown } from "lucide-react";

/** Layered architecture view: each layer is a row of components, flowing top → bottom. */
export function ArchitectureDiagram({ layers }: { layers: { layer: string; components: string[] }[] }) {
  return (
    <div className="flex flex-col items-stretch gap-1" role="img" aria-label={`Architecture: ${layers.map((l) => `${l.layer} (${l.components.join(", ")})`).join(" → ")}`}>
      {layers.map((l, i) => (
        <div key={l.layer} className="flex flex-col items-center gap-1">
          <div className="w-full rounded-lg border bg-card p-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{l.layer}</p>
            <div className="flex flex-wrap gap-2">
              {l.components.map((c) => <span key={c} className="rounded-md border bg-muted px-2.5 py-1.5 text-xs">{c}</span>)}
            </div>
          </div>
          {i < layers.length - 1 ? <ArrowDown className="h-4 w-4 text-muted-foreground" aria-hidden /> : null}
        </div>
      ))}
    </div>
  );
}
