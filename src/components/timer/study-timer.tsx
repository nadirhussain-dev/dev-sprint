"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Plus, Square, Timer as TimerIcon } from "lucide-react";
import { toast } from "sonner";
import { addManualTime, pauseTimer, resumeTimer, startTimer, stopTimer } from "@/app/actions/timer";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn, formatClock, formatMinutes, pct } from "@/lib/utils";
import type { StudySession } from "@/lib/types";

export function StudyTimer({ active, serverNow, subjects, dayNumber, defaultSlot, todayMinutes, todayVerified, targetMinutes, streakMinMinutes }: {
  active: StudySession | null;
  serverNow: number;
  subjects: string[];
  dayNumber: number | null;
  defaultSlot: "morning" | "evening";
  todayMinutes: number;
  todayVerified: number;
  targetMinutes: number;
  streakMinMinutes: number;
}) {
  const router = useRouter();
  const skew = useMemo(() => serverNow - Date.now(), [serverNow]);
  const [session, setSession] = useState<StudySession | null>(active);
  const [now, setNow] = useState(() => Date.now() + skew);
  const [mode, setMode] = useState<"stopwatch" | "countdown">("stopwatch");
  const [countdown, setCountdown] = useState(25);
  const [subject, setSubject] = useState(subjects[0] ?? "Study");
  const [slot, setSlot] = useState<"morning" | "evening">(defaultSlot);
  const [manualOpen, setManualOpen] = useState(false);
  const [pending, start] = useTransition();
  const stopping = useRef(false);

  useEffect(() => setSession(active), [active]);

  // Elapsed is derived from server timestamps, never from an in-memory counter — survives refreshes.
  const elapsed = session
    ? session.accumulated_seconds + (session.status === "running" && session.last_resumed_at ? Math.max(0, (now - Date.parse(session.last_resumed_at)) / 1000) : 0)
    : 0;
  const remaining = session?.mode === "countdown" && session.target_seconds ? Math.max(0, session.target_seconds - elapsed) : null;

  useEffect(() => {
    if (session?.status !== "running") return;
    const id = setInterval(() => setNow(Date.now() + skew), 1000);
    return () => clearInterval(id);
  }, [session?.status, skew]);

  useEffect(() => {
    document.title = session?.status === "running" ? `${formatClock(remaining ?? elapsed)} · DevSprint` : "DevSprint";
  }, [session?.status, elapsed, remaining]);

  // Keep every open device in sync.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel("timer")
      .on("postgres_changes", { event: "*", schema: "public", table: "study_sessions" }, () => router.refresh())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [router]);

  const stop = useCallback(() => {
    if (stopping.current) return;
    stopping.current = true;
    start(async () => {
      const res = await stopTimer();
      stopping.current = false;
      if (!res.ok) { toast.error(res.error); return; }
      setSession(null);
      const { minutes, capped, qualified } = res.data!;
      if (minutes < 1) toast("Under a minute — nothing logged");
      else toast.success(`Logged ${formatMinutes(minutes)}${capped ? " (capped at 5h)" : ""}`, { description: qualified ? "Today's streak requirement is met 🔥" : undefined });
      router.refresh();
    });
  }, [router]);

  useEffect(() => {
    if (remaining === 0 && session?.status === "running") {
      if ("Notification" in window && Notification.permission === "granted") new Notification("Countdown finished", { body: session.subject });
      stop();
    }
  }, [remaining, session, stop]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: StudySession }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) { toast.error(res.error ?? "Something went wrong"); router.refresh(); return; }
      if (res.data) { setSession(res.data); setNow(Date.now() + skew); }
    });

  const verifiedPct = pct(todayVerified, streakMinMinutes);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><TimerIcon className="h-4 w-4" />Study timer</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setManualOpen(true)}><Plus />Manual</Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="text-center">
          <p className={cn("font-mono text-4xl font-medium tabular-nums tracking-tight", session?.status === "paused" && "text-muted-foreground")} aria-live="off">
            {formatClock(remaining ?? elapsed)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {session ? `${session.status === "paused" ? "Paused · " : ""}${session.subject} · ${session.session_slot}${session.mode === "countdown" ? " · countdown" : ""}` : "Not running"}
          </p>
        </div>

        {session ? (
          <div className="flex justify-center gap-2">
            {session.status === "running"
              ? <Button variant="outline" onClick={() => run(pauseTimer)} disabled={pending}><Pause />Pause</Button>
              : <Button variant="outline" onClick={() => run(resumeTimer)} disabled={pending}><Play />Resume</Button>}
            <Button onClick={stop} disabled={pending}><Square />Stop & save</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <NativeSelect aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="Revision">Revision</option>
                <option value="Project work">Project work</option>
                <option value="DSA practice">DSA practice</option>
              </NativeSelect>
              <NativeSelect aria-label="Session" value={slot} onChange={(e) => setSlot(e.target.value as "morning" | "evening")}>
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
              </NativeSelect>
            </div>
            <div className="flex gap-2">
              <div className="flex rounded-md border p-0.5 text-xs" role="radiogroup" aria-label="Timer mode">
                {(["stopwatch", "countdown"] as const).map((m) => (
                  <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                    className={cn("rounded px-2.5 py-1 capitalize", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{m}</button>
                ))}
              </div>
              {mode === "countdown" ? (
                <Input aria-label="Countdown minutes" type="number" min={1} max={300} value={countdown} onChange={(e) => setCountdown(Number(e.target.value))} className="h-8 w-20" />
              ) : null}
              <Button className="ml-auto" size="sm" disabled={pending}
                onClick={() => run(() => startTimer({ subject, slot, mode, targetMinutes: mode === "countdown" ? countdown : undefined, dayNumber }))}>
                <Play />Start
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5 border-t pt-3">
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Today</span><span className="font-mono">{formatMinutes(todayMinutes)} / {formatMinutes(targetMinutes)}</span></div>
          <Progress value={pct(todayMinutes, targetMinutes)} label="Today's study time" />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Timed (counts for streak): {formatMinutes(todayVerified)} / {formatMinutes(streakMinMinutes)}</span>
            <span>{Math.min(100, verifiedPct)}%</span>
          </div>
        </div>
      </CardContent>
      <ManualTimeDialog open={manualOpen} onOpenChange={setManualOpen} subjects={subjects} dayNumber={dayNumber} defaultSlot={slot} />
    </Card>
  );
}

function ManualTimeDialog({ open, onOpenChange, subjects, dayNumber, defaultSlot }: {
  open: boolean; onOpenChange: (o: boolean) => void; subjects: string[]; dayNumber: number | null; defaultSlot: "morning" | "evening";
}) {
  const [minutes, setMinutes] = useState(30);
  const [subject, setSubject] = useState(subjects[0] ?? "Study");
  const [slot, setSlot] = useState(defaultSlot);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); setConfirmed(false); }}>
      <DialogContent>
        <DialogTitle>Add study time manually</DialogTitle>
        <DialogDescription>For study you did away from the timer. Manual time counts toward your hours, but only timed sessions count as verified time for streaks.</DialogDescription>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1"><Label htmlFor="m-min">Minutes</Label><Input id="m-min" type="number" min={1} max={480} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor="m-slot">Session</Label>
            <NativeSelect id="m-slot" value={slot} onChange={(e) => setSlot(e.target.value as "morning" | "evening")}><option value="morning">Morning</option><option value="evening">Evening</option></NativeSelect>
          </div>
          <div className="col-span-2 flex flex-col gap-1"><Label htmlFor="m-sub">Subject</Label>
            <NativeSelect id="m-sub" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {subjects.map((s) => <option key={s}>{s}</option>)}<option>Revision</option><option>Project work</option><option>DSA practice</option>
            </NativeSelect>
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
          I confirm I actually studied {formatMinutes(minutes || 0)} today.
        </label>
        <Button disabled={!confirmed || pending || minutes < 1} onClick={() => start(async () => {
          const res = await addManualTime({ minutes, subject, slot, dayNumber, confirmed: true });
          if (!res.ok) { toast.error(res.error); return; }
          toast.success(res.message ?? "Logged");
          onOpenChange(false); setConfirmed(false);
        })}>Log time</Button>
      </DialogContent>
    </Dialog>
  );
}
