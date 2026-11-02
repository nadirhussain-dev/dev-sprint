"use client";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { completeOnboarding } from "@/app/actions/onboarding";
import { OnboardingSchema, type OnboardingInput } from "@/lib/validation";
import { endDate, formatLongDate, todayInTz } from "@/lib/domain/dates";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Field({ label, error, children, htmlFor }: { label: string; error?: string; children: React.ReactNode; htmlFor: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export function OnboardingForm({ defaultName, existingStart }: { defaultName: string; existingStart: string | null }) {
  const browserTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const zones = useMemo(() => (typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [browserTz]), [browserTz]);
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<OnboardingInput>({
    resolver: zodResolver(OnboardingSchema),
    defaultValues: {
      full_name: defaultName,
      avatar_url: "",
      start_date: existingStart ?? todayInTz(browserTz),
      timezone: browserTz,
      daily_target_minutes: 240,
      morning_minutes: 120,
      evening_minutes: 120,
      experience_level: "mid",
      target_level: "senior",
      target_position: "Senior Full-Stack Engineer",
      morning_reminder_time: "07:00",
      evening_reminder_time: "19:00",
    },
  });
  const { register, handleSubmit, watch, formState: { errors } } = form;
  const start = watch("start_date");
  const end = /^\d{4}-\d{2}-\d{2}$/.test(start ?? "") ? endDate(start as string) : null;

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const res = await completeOnboarding(values);
      if (res && !res.ok) { setServerError(res.error); toast.error(res.error); }
    });
  });

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
      <Card>
        <CardHeader><CardTitle>About you</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="full_name" error={errors.full_name?.message}>
            <Input id="full_name" {...register("full_name")} />
          </Field>
          <Field label="Profile picture URL (optional)" htmlFor="avatar_url" error={errors.avatar_url?.message}>
            <Input id="avatar_url" placeholder="https://github.com/you.png" {...register("avatar_url")} />
          </Field>
          <Field label="Current experience" htmlFor="experience_level">
            <NativeSelect id="experience_level" {...register("experience_level")}>
              <option value="junior">Junior (0–2 years)</option>
              <option value="mid">Mid-level (2–5 years)</option>
              <option value="senior">Senior (5+ years)</option>
            </NativeSelect>
          </Field>
          <Field label="Preparing for" htmlFor="target_level">
            <NativeSelect id="target_level" {...register("target_level")}>
              <option value="senior">Senior-level interviews</option>
              <option value="mid">Mid-level interviews</option>
            </NativeSelect>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Target position" htmlFor="target_position" error={errors.target_position?.message}>
              <Input id="target_position" {...register("target_position")} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" htmlFor="start_date" error={errors.start_date?.message}>
            <Input id="start_date" type="date" disabled={Boolean(existingStart)} {...register("start_date")} />
          </Field>
          <div className="flex flex-col justify-end rounded-md border bg-muted px-3 py-2 text-xs">
            <span className="text-muted-foreground">Your 90-day plan ends</span>
            <span className="font-medium">{end ? formatLongDate(end) : "—"}</span>
          </div>
          <Field label="Timezone" htmlFor="timezone" error={errors.timezone?.message}>
            <NativeSelect id="timezone" {...register("timezone")}>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Daily learning target (minutes)" htmlFor="daily_target_minutes" error={errors.daily_target_minutes?.message}>
            <Input id="daily_target_minutes" type="number" step={15} {...register("daily_target_minutes")} />
          </Field>
          <Field label="Morning study (minutes)" htmlFor="morning_minutes">
            <Input id="morning_minutes" type="number" step={15} {...register("morning_minutes")} />
          </Field>
          <Field label="Evening study (minutes)" htmlFor="evening_minutes">
            <Input id="evening_minutes" type="number" step={15} {...register("evening_minutes")} />
          </Field>
          <Field label="Morning reminder" htmlFor="morning_reminder_time">
            <Input id="morning_reminder_time" type="time" {...register("morning_reminder_time")} />
          </Field>
          <Field label="Evening reminder" htmlFor="evening_reminder_time">
            <Input id="evening_reminder_time" type="time" {...register("evening_reminder_time")} />
          </Field>
        </CardContent>
      </Card>

      {serverError ? <p role="alert" className="text-sm text-danger">{serverError}</p> : null}
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? <Loader2 className="animate-spin" /> : null}
        Start my sprint
      </Button>
    </form>
  );
}
