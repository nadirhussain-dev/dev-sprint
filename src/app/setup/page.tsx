import { isSupabaseConfigured } from "@/lib/env";
import { Logo } from "@/components/logo";

export default function SetupPage() {
  const configured = isSupabaseConfigured();
  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Finish setting up DevSprint</h1>
      {configured ? (
        <p className="mt-3 text-sm text-muted-foreground">Supabase is configured. <a className="underline" href="/login">Continue to sign in</a>.</p>
      ) : (
        <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm">
          <li>Create a Supabase project and copy its URL and anon key.</li>
          <li>Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env.local</code> and fill in the values, including <code className="font-mono">ALLOWED_EMAILS</code>.</li>
          <li>Apply the SQL in <code className="font-mono">supabase/migrations</code> (in order) with <code className="font-mono">supabase db push</code> or the SQL editor.</li>
          <li>Restart <code className="font-mono">npm run dev</code>.</li>
        </ol>
      )}
    </main>
  );
}
