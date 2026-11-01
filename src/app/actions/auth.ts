"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailAllowed, publicEnv, serverEnv } from "@/lib/env";

const EmailSchema = z.object({ email: z.email("Enter a valid email address").transform((e) => e.trim().toLowerCase()) });

export type SignInState = { status: "idle" } | { status: "error"; message: string } | { status: "sent"; email: string };

/**
 * Email-only sign-in (no password).
 *  - AUTH_MODE=instant (default): allow-listed emails are signed in immediately, server-side.
 *  - AUTH_MODE=magiclink: a one-time link is emailed instead (recommended for public deployments).
 */
export async function signInWithEmail(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = EmailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid email" };
  const { email } = parsed.data;
  const env = serverEnv();

  if (env.allowedEmails.length === 0) {
    return { status: "error", message: "No emails are allowed yet. Set ALLOWED_EMAILS in your environment." };
  }
  if (!isEmailAllowed(email)) {
    return { status: "error", message: "This email isn't on the allow-list for this DevSprint instance." };
  }

  const supabase = await createClient();

  if (env.authMode === "magiclink") {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: `${publicEnv.siteUrl}/auth/confirm?next=/dashboard` },
    });
    if (error) return { status: "error", message: error.message };
    return { status: "sent", email };
  }

  // Instant mode: create (if needed) and sign in the allow-listed user without an inbox round-trip.
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { status: "error", message: "Instant sign-in needs SUPABASE_SERVICE_ROLE_KEY. Set it, or use AUTH_MODE=magiclink." };
  }
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error && !/already|registered|exists/i.test(created.error.message)) {
    return { status: "error", message: created.error.message };
  }
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) return { status: "error", message: link.error?.message ?? "Could not create a sign-in token." };

  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error) return { status: "error", message: error.message };
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
