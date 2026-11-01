export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <figure className="overflow-hidden rounded-md border bg-muted">
      {label ? <figcaption className="border-b px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</figcaption> : null}
      <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed"><code>{code}</code></pre>
    </figure>
  );
}
