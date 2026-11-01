"use client";
import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateProfile, updateReminders, updateSchedule } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Preferences, Profile } from "@/lib/types";

function useSave() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => { const r = await fn(); if (r.ok) toast.success(r.message ?? "Saved"); else toast.error(r.error ?? "Failed"); });
  return { pending, run };
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [v, setV] = useState({ full_name: profile.full_name ?? "", avatar_url: profile.avatar_url ?? "", experience_level: profile.experience_level, target_level: profile.target_level, target_position: profile.target_position });
  const { pending, run } = useSave();
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => updateProfile(v)); }}>
      <div className="flex flex-col gap-1.5"><Label htmlFor="p-name">Full name</Label><Input id="p-name" value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="p-av">Profile picture URL</Label><Input id="p-av" value={v.avatar_url} onChange={(e) => setV({ ...v, avatar_url: e.target.value })} placeholder="https://…" /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="p-exp">Experience</Label>
        <NativeSelect id="p-exp" value={v.experience_level} onChange={(e) => setV({ ...v, experience_level: e.target.value as Profile["experience_level"] })}>
          <option value="junior">Junior</option><option value="mid">Mid-level</option><option value="senior">Senior</option>
        </NativeSelect></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="p-target">Preparing for</Label>
        <NativeSelect id="p-target" value={v.target_level} onChange={(e) => setV({ ...v, target_level: e.target.value as Profile["target_level"] })}>
          <option value="senior">Senior-level</option><option value="mid">Mid-level</option>
        </NativeSelect></div>
      <div className="flex flex-col gap-1.5 sm:col-span-2"><Label htmlFor="p-pos">Target position</Label><Input id="p-pos" value={v.target_position} onChange={(e) => setV({ ...v, target_position: e.target.value })} /></div>
      <Button type="submit" disabled={pending} className="justify-self-start">{pending ? <Loader2 className="animate-spin" /> : null}Save profile</Button>
    </form>
  );
}

export function ScheduleForm({ prefs }: { prefs: Preferences }) {
  const zones = useMemo(() => (typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [prefs.timezone]), [prefs.timezone]);
  const [v, setV] = useState({ timezone: prefs.timezone, daily_target_minutes: prefs.daily_target_minutes, morning_minutes: prefs.morning_minutes, evening_minutes: prefs.evening_minutes, streak_min_minutes: prefs.streak_min_minutes });
  const { pending, run } = useSave();
  const num = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: Number(e.target.value) });
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => updateSchedule(v)); }}>
      <div className="flex flex-col gap-1.5 sm:col-span-2"><Label htmlFor="s-tz">Timezone</Label>
        <NativeSelect id="s-tz" value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })}>{zones.map((z) => <option key={z}>{z}</option>)}</NativeSelect>
        <p className="text-[11px] text-muted-foreground">Changing timezone affects how today and future days are evaluated. Past streak days are kept as recorded.</p>
      </div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="s-daily">Daily target (minutes)</Label><Input id="s-daily" type="number" step={15} value={v.daily_target_minutes} onChange={num("daily_target_minutes")} /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="s-streak">Streak minimum — timed minutes</Label><Input id="s-streak" type="number" step={15} value={v.streak_min_minutes} onChange={num("streak_min_minutes")} /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="s-m">Morning study (minutes)</Label><Input id="s-m" type="number" step={15} value={v.morning_minutes} onChange={num("morning_minutes")} /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="s-e">Evening study (minutes)</Label><Input id="s-e" type="number" step={15} value={v.evening_minutes} onChange={num("evening_minutes")} /></div>
      <Button type="submit" disabled={pending} className="justify-self-start">{pending ? <Loader2 className="animate-spin" /> : null}Save schedule</Button>
    </form>
  );
}

const REMINDERS = [
  { key: "morning", label: "Morning session", desc: "When your morning study block starts" },
  { key: "evening", label: "Evening session", desc: "When your evening practice block starts" },
  { key: "incomplete", label: "Incomplete tasks", desc: "If required tasks are still open" },
  { key: "streak_warning", label: "Streak warning", desc: "If today hasn't qualified and you have a streak" },
  { key: "mock", label: "Mock interview", desc: "On mock interview days" },
] as const;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ReminderForm({ prefs }: { prefs: Preferences }) {
  const [v, setV] = useState({
    morning_reminder_enabled: prefs.morning_reminder_enabled, morning_reminder_time: prefs.morning_reminder_time.slice(0, 5),
    evening_reminder_enabled: prefs.evening_reminder_enabled, evening_reminder_time: prefs.evening_reminder_time.slice(0, 5),
    incomplete_reminder_enabled: prefs.incomplete_reminder_enabled, incomplete_reminder_time: prefs.incomplete_reminder_time.slice(0, 5),
    streak_warning_enabled: prefs.streak_warning_enabled, streak_warning_time: prefs.streak_warning_time.slice(0, 5),
    weekly_revision_enabled: prefs.weekly_revision_enabled, weekly_revision_dow: prefs.weekly_revision_dow, weekly_revision_time: prefs.weekly_revision_time.slice(0, 5),
    mock_reminder_enabled: prefs.mock_reminder_enabled, mock_reminder_time: prefs.mock_reminder_time.slice(0, 5),
  });
  const { pending, run } = useSave();
  return (
    <form className="flex flex-col gap-1" onSubmit={(e) => { e.preventDefault(); run(() => updateReminders(v)); }}>
      {REMINDERS.map((r) => {
        const en = (r.key === "streak_warning" ? "streak_warning_enabled" : `${r.key}_reminder_enabled`) as keyof typeof v;
        const tm = (r.key === "streak_warning" ? "streak_warning_time" : `${r.key}_reminder_time`) as keyof typeof v;
        return (
          <div key={r.key} className="flex items-center gap-3 border-b py-3 last:border-0">
            <Switch checked={Boolean(v[en])} onCheckedChange={(c) => setV({ ...v, [en]: c })} aria-label={r.label} />
            <div className="flex-1"><p className="text-sm">{r.label}</p><p className="text-xs text-muted-foreground">{r.desc}</p></div>
            <Input type="time" aria-label={`${r.label} time`} className="w-28" value={String(v[tm])} disabled={!v[en]} onChange={(e) => setV({ ...v, [tm]: e.target.value })} />
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3 py-3">
        <Switch checked={v.weekly_revision_enabled} onCheckedChange={(c) => setV({ ...v, weekly_revision_enabled: c })} aria-label="Weekly revision" />
        <div className="flex-1"><p className="text-sm">Weekly revision</p><p className="text-xs text-muted-foreground">A weekly nudge to clear your revision queue</p></div>
        <NativeSelect aria-label="Weekly revision day" className="w-32" value={v.weekly_revision_dow} disabled={!v.weekly_revision_enabled} onChange={(e) => setV({ ...v, weekly_revision_dow: Number(e.target.value) })}>
          {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </NativeSelect>
        <Input type="time" aria-label="Weekly revision time" className="w-28" value={v.weekly_revision_time} disabled={!v.weekly_revision_enabled} onChange={(e) => setV({ ...v, weekly_revision_time: e.target.value })} />
      </div>
      <Button type="submit" disabled={pending} className="mt-2 self-start">{pending ? <Loader2 className="animate-spin" /> : null}Save reminders</Button>
    </form>
  );
}
