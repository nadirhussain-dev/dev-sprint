"use client";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteNote, saveDayNote } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { NoteRow } from "@/lib/types";

export function DayNotes({ dayNumber, notes }: { dayNumber: number; notes: NoteRow[] }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <form className="flex flex-col gap-2" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveDayNote(dayNumber, body);
          if (!res.ok) { toast.error(res.error); return; }
          setBody(""); toast.success("Note saved");
        });
      }}>
        <Textarea aria-label="New note" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Summaries, important interview questions, things to revisit…" />
        <Button type="submit" size="sm" disabled={pending || !body.trim()} className="self-end">{pending ? <Loader2 className="animate-spin" /> : null}Save note</Button>
      </form>
      {notes.map((n) => (
        <div key={n.id} className="group rounded-md border p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="whitespace-pre-wrap text-sm">{n.body}</p>
            <button aria-label="Delete note" className="text-muted-foreground opacity-0 hover:text-danger group-hover:opacity-100"
              onClick={() => start(async () => { await deleteNote(n.id, `/roadmap/day/${dayNumber}`); })}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.updated_at).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
