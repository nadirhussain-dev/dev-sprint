import type { Metadata } from "next";
import { getAppContext } from "@/lib/data/context";
import { formatLongDate } from "@/lib/domain/dates";
import { publicEnv, serverEnv } from "@/lib/env";
import { isPushConfigured } from "@/lib/push/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm, ReminderForm, ScheduleForm } from "@/components/settings/settings-forms";
import { InstallApp, PushSetup } from "@/components/settings/push-setup";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await getAppContext();
  const { count } = await ctx.supabase.from("push_subscriptions").select("id", { count: "exact", head: true });
  const env = serverEnv();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header><h1 className="text-2xl font-semibold tracking-tight">Settings</h1><p className="text-sm text-muted-foreground">Signed in as {ctx.email}</p></header>

      <Card>
        <CardHeader><CardTitle>Your sprint</CardTitle><CardDescription>The start date is fixed so your history stays honest.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div><p className="text-xs text-muted-foreground">Start</p><p className="font-medium">{formatLongDate(ctx.plan.start_date)}</p></div>
          <div><p className="text-xs text-muted-foreground">End (start + 59 days)</p><p className="font-medium">{formatLongDate(ctx.plan.end_date)}</p></div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle>Profile</CardTitle></CardHeader><CardContent><ProfileForm profile={ctx.profile} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Schedule</CardTitle><CardDescription>A streak day is earned by finishing all required tasks for the day, or by logging the minimum in timed study.</CardDescription></CardHeader><CardContent><ScheduleForm prefs={ctx.prefs} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Reminders</CardTitle><CardDescription>Times are in {ctx.tz}.</CardDescription></CardHeader><CardContent><ReminderForm prefs={ctx.prefs} /></CardContent></Card>
      <Card>
        <CardHeader><CardTitle>Notifications & app</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-5">
          <PushSetup vapidPublicKey={publicEnv.vapidPublicKey} serverPushReady={isPushConfigured() && Boolean(env.serviceRoleKey && env.cronSecret)} deviceCount={count ?? 0} />
          <div className="border-t pt-4"><InstallApp /></div>
        </CardContent>
      </Card>
    </div>
  );
}
