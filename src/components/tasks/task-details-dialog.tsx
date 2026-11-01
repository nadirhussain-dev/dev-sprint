"use client";
import { useState, useTransition } from "react";
import { Link2, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { saveTaskDetails } from "@/app/actions/tasks";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EvidenceForm, EvidenceList } from "./evidence";
import type { CurriculumTask, Evidence, Resource, TaskProgress } from "@/lib/types";

export function TaskDetailsDialog({ task, progress, evidence, open, onOpenChange }: {
  task: CurriculumTask; progress: TaskProgress | undefined; evidence: Evidence[]; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [notes, setNotes] = useState(progress?.notes ?? "");
  const [mistakes, setMistakes] = useState(progress?.mistakes ?? "");
  const [resources, setResources] = useState<Resource[]>(progress?.resources ?? []);
  const [rTitle, setRTitle] = useState("");
  const [rUrl, setRUrl] = useState("");
  const [pending, start] = useTransition();
  const practical = ["assignment", "practice", "mock"].includes(task.task_type);

  const save = () => start(async () => {
    const res = await saveTaskDetails(task.id, { notes, mistakes, resources });
    if (res.ok) { toast.success("Saved"); onOpenChange(false); } else toast.error(res.error);
  });

  const addResource = () => {
    try {
      const url = new URL(rUrl);
      setResources((r) => [...r, { title: rTitle.trim() || url.hostname, url: url.toString() }]);
      setRTitle(""); setRUrl("");
    } catch {
      toast.error("Enter a valid URL");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogTitle>{task.title}</DialogTitle>
        <DialogDescription>{task.description}</DialogDescription>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Key takeaways, gotchas, links to your code…" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mistakes">Mistakes to remember</Label>
          <Textarea id="mistakes" value={mistakes} onChange={(e) => setMistakes(e.target.value)} placeholder="What tripped you up? Writing it down is how you stop repeating it." className="min-h-16" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Learning resources</Label>
          {resources.length ? (
            <ul className="flex flex-col gap-1">
              {resources.map((r, i) => (
                <li key={`${r.url}-${i}`} className="flex items-center gap-2 text-sm">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <a href={r.url} target="_blank" rel="noreferrer" className="truncate underline">{r.title}</a>
                  <button aria-label="Remove resource" className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setResources((x) => x.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2">
            <Input aria-label="Resource title" placeholder="Title" value={rTitle} onChange={(e) => setRTitle(e.target.value)} className="w-1/3" />
            <Input aria-label="Resource URL" placeholder="https://…" value={rUrl} onChange={(e) => setRUrl(e.target.value)} />
            <Button type="button" variant="outline" size="icon" aria-label="Add resource" onClick={addResource}><Plus /></Button>
          </div>
        </div>
        <Button onClick={save} disabled={pending} className="self-end">{pending ? <Loader2 className="animate-spin" /> : null}Save</Button>

        {practical ? (
          <div className="flex flex-col gap-3 border-t pt-4">
            <div>
              <p className="text-sm font-semibold">Evidence</p>
              <p className="text-xs text-muted-foreground">Practical tasks with evidence count toward your project readiness.</p>
            </div>
            <EvidenceList items={evidence} />
            <EvidenceForm taskId={task.id} defaultTitle={task.title.replace(/^(Code|Timed): /, "")} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
