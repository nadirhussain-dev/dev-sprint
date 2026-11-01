import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/result";
import { isEmailAllowed } from "@/lib/env";
import { planPosition, todayInTz, timeInTz, hourInTz, weekdayInTz, endDate, type PlanPosition } from "@/lib/domain/dates";
import type { Plan, Preferences, Profile } from "@/lib/types";

export interface AppContext {
  userId: string;
  email: string;
  profile: Profile;
  prefs: Preferences;
  plan: Plan;
  tz: string;
  today: string;
  localTime: string;
  hour: number;
  weekday: number;
  position: PlanPosition;
}

/** Signed-in user or redirect to /login. Also enforces the email allow-list. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isEmailAllowed(user.email)) {
    await supabase.auth.signOut();
    redirect("/login?error=not_allowed");
  }
  return { supabase, user };
});

/**
 * Everything a signed-in page needs: profile, preferences, plan, and "today" in the user's timezone.
 * Redirects to onboarding until a plan exists.
 */
export const getAppContext = cache(async (): Promise<AppContext & { supabase: Awaited<ReturnType<typeof createClient>> }> => {
  const { supabase, user } = await requireUser();
  const [profile, prefs, plan] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(one<Profile>),
    supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle().then(one<Preferences>),
    supabase.from("learning_plans").select("*").eq("user_id", user.id).maybeSingle().then(one<Plan>),
  ]);
  if (!profile || !prefs || !plan || !profile.onboarded) redirect("/onboarding");

  const tz = prefs.timezone;
  const now = new Date();
  const today = todayInTz(tz, now);
  return {
    supabase,
    userId: user.id,
    email: user.email ?? "",
    profile,
    prefs,
    plan: { ...plan, end_date: plan.end_date ?? endDate(plan.start_date) },
    tz,
    today,
    localTime: timeInTz(tz, now),
    hour: hourInTz(tz, now),
    weekday: weekdayInTz(tz, now),
    position: planPosition(plan.start_date, today),
  };
});
