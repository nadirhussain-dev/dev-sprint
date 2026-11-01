/** Centralized, validated access to environment variables. Never import server values into client code. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
};

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

export function serverEnv() {
  return {
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    allowedEmails: (process.env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    authMode: (process.env.AUTH_MODE === "magiclink" ? "magiclink" : "instant") as "instant" | "magiclink",
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
    vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
    cronSecret: process.env.CRON_SECRET ?? "",
  };
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = serverEnv().allowedEmails;
  return list.length > 0 && list.includes(email.toLowerCase());
}
