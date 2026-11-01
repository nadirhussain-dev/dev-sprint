"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeRevisionItem, reviewItem } from "@/app/actions/revision";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatShortDate } from "@/lib/domain/dates";
import { SKILL_LABELS, type RevisionItem } from "@/lib/types";

const TYPE: Record<RevisionItem["source_type"], string> = { task: "Task", question: "Question", challenge: "Challenge", design: "Design" };

export function RevisionCard({ item, due }: { item: RevisionItem; due: boolean }) {
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();
  if (gone) return null;
  const act = (o: "again" | "good" | "easy") => start(async () => {
    const res = await reviewItem(item.id, o);
    if (!res.ok) { toast.error(res.error); return; }
    setGone(true);
    toast.success(res.data!.resolved ? "Mastered — removed from the queue" : `Next review ${formatShortDate(res.data!.dueDate)}`);
  });
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{TYPE[item.source_type]}</Badge>
          <Badge variant="outline">{SKILL_LABELS[item.skill_area]}</Badge>
          <span className="text-[11px] text-muted-foreground">{due ? "Due" : `Due ${formatShortDate(item.due_date)}`} · review #{item.repetitions + 1}</span>
        </div>
        <Link href={item.link} className="flex items-center gap-1 text-sm font-medium hover:underline">{item.title}<ExternalLink className="h-3 w-3 text-muted-foreground" /></Link>
      </div>
      {due ? (
        <div className="flex items-center gap-1.5">
          <span className="mr-1 hidden text-xs text-muted-foreground lg:inline">Could you explain it now?</span>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => act("again")}>Not yet</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => act("good")}>Mostly</Button>
          <Button size="sm" disabled={pending} onClick={() => act("easy")}>Easily</Button>
        </div>
      ) : null}
      <button aria-label="Remove from queue" className="self-end text-muted-foreground hover:text-danger sm:self-center" disabled={pending}
        onClick={() => start(async () => { await removeRevisionItem(item.id); setGone(true); })}><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}
