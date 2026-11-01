"use client";
import { useActionState } from "react";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { signInWithEmail, type SignInState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInWithEmail, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="flex flex-col items-center gap-2 text-center animate-fade-up">
        <MailCheck className="h-6 w-6" />
        <p className="text-sm font-medium">Check {state.email}</p>
        <p className="text-xs text-muted-foreground">Open the sign-in link on this device. You'll stay signed in afterwards.</p>
      </div>
    );
  }

  const error = state.status === "error" ? state.message : initialError;
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required autoFocus />
      </div>
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />}
        Continue
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">No password needed.</p>
    </form>
  );
}
