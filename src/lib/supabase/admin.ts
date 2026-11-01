import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS — use ONLY in trusted server code
 * (instant sign-in for allow-listed emails, the reminder cron). Never import from client components.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") throw new Error("Admin client is server-only");
  const key = serverEnv().serviceRoleKey;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(publicEnv.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
