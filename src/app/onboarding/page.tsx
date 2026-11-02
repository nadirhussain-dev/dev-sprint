import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data/context";
import { OnboardingForm } from "./onboarding-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Set up your sprint" };

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: plan }] = await Promise.all([
    supabase.from("profiles").select("onboarded, full_name").eq("id", user.id).maybeSingle(),
    supabase.from("learning_plans").select("start_date").eq("user_id", user.id).maybeSingle(),
  ]);
  if (profile?.onboarded && plan) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Set up your 90-day plan</h1>
      <p className="mt-1 text-sm text-muted-foreground">You can change everything here later except the start date.</p>
      <OnboardingForm
        defaultName={(profile?.full_name as string | null) ?? ""}
        existingStart={(plan?.start_date as string | undefined) ?? null}
      />
    </main>
  );
}
