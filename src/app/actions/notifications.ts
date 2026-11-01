"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data/context";
import type { ActionResult } from "@/lib/types";

export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  const { supabase } = await requireUser();
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  const res = await q;
  if (res.error) return { ok: false, error: res.error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

const SubscriptionSchema = {
  parse(input: unknown): { endpoint: string; p256dh: string; auth: string } | null {
    if (!input || typeof input !== "object") return null;
    const s = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    if (typeof s.endpoint !== "string" || !s.endpoint.startsWith("https://")) return null;
    if (typeof s.keys?.p256dh !== "string" || typeof s.keys?.auth !== "string") return null;
    return { endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth };
  },
};

export async function savePushSubscription(subscription: unknown, userAgent: string): Promise<ActionResult> {
  const sub = SubscriptionSchema.parse(subscription);
  if (!sub) return { ok: false, error: "Invalid push subscription" };
  const { supabase, user } = await requireUser();
  // Endpoint is globally unique; remove any stale row for it first (RLS limits this to our own rows).
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const res = await supabase.from("push_subscriptions").insert({ user_id: user.id, ...sub, user_agent: userAgent.slice(0, 300) });
  if (res.error) return { ok: false, error: res.error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const res = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (res.error) return { ok: false, error: res.error.message };
  revalidatePath("/settings");
  return { ok: true };
}
