import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  not_allowed: "That account isn't on the allow-list for this instance.",
  link_invalid: "That sign-in link is invalid or expired. Try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <Link href="/" className="mb-6 flex items-center gap-2"><Logo /></Link>
        <h1 className="text-lg font-semibold tracking-tight">Sign in to DevSprint</h1>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">Enter your email to continue your sprint.</p>
        <LoginForm initialError={error ? ERRORS[error] : undefined} />
      </div>
    </main>
  );
}
