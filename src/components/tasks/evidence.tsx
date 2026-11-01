"use client";
import { useRef, useState, useTransition } from "react";
import { ExternalLink, Github, ImageIcon, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addEvidence, deleteEvidence, getScreenshotUrl } from "@/app/actions/evidence";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Evidence } from "@/lib/types";

export function EvidenceList({ items }: { items: Evidence[] }) {
  const [, start] = useTransition();
  if (items.length === 0) return <p className="text-xs text-muted-foreground">No evidence attached yet.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((e) => (
        <li key={e.id} className="rounded-md border p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{e.title}</p>
            <button aria-label="Delete evidence" className="text-muted-foreground hover:text-danger" onClick={() => start(async () => { await deleteEvidence(e.id); toast("Evidence removed"); })}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{e.explanation}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            {e.github_url ? <a className="flex items-center gap-1 underline" href={e.github_url} target="_blank" rel="noreferrer"><Github className="h-3 w-3" />Code</a> : null}
            {e.demo_url ? <a className="flex items-center gap-1 underline" href={e.demo_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" />Demo</a> : null}
            {e.screenshot_path ? (
              <button className="flex items-center gap-1 underline" onClick={async () => {
                const url = await getScreenshotUrl(e.screenshot_path!);
                if (url) window.open(url, "_blank", "noopener"); else toast.error("Couldn't open screenshot");
              }}><ImageIcon className="h-3 w-3" />Screenshot</button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function EvidenceForm({ taskId, milestoneId, defaultTitle, onDone }: { taskId?: string; milestoneId?: string; defaultTitle: string; onDone?: () => void }) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      ref={ref}
      className="flex flex-col gap-2.5"
      action={(fd) => start(async () => {
        if (taskId) fd.set("task_id", taskId);
        if (milestoneId) fd.set("milestone_id", milestoneId);
        const res = await addEvidence(fd);
        if (!res.ok) { setError(res.error); return; }
        setError(null);
        ref.current?.reset();
        toast.success("Evidence attached");
        onDone?.();
      })}
    >
      <div className="flex flex-col gap-1"><Label htmlFor="ev-title">Title</Label><Input id="ev-title" name="title" defaultValue={defaultTitle} required /></div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1"><Label htmlFor="ev-gh">GitHub URL</Label><Input id="ev-gh" name="github_url" type="url" placeholder="https://github.com/…" /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="ev-demo">Demo URL</Label><Input id="ev-demo" name="demo_url" type="url" placeholder="https://…" /></div>
      </div>
      <div className="flex flex-col gap-1"><Label htmlFor="ev-shot">Screenshot (optional, ≤5 MB)</Label><Input id="ev-shot" name="screenshot" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="pt-1.5" /></div>
      <div className="flex flex-col gap-1"><Label htmlFor="ev-exp">Explanation</Label><Textarea id="ev-exp" name="explanation" placeholder="What did you build, what trade-offs did you make, what would you improve?" required /></div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <Button type="submit" size="sm" disabled={pending} className="self-start">{pending ? <Loader2 className="animate-spin" /> : null}Attach evidence</Button>
    </form>
  );
}
