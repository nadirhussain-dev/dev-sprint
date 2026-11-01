import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/env";
import { isPushConfigured, sendPush, type PushTarget } from "@/lib/push/server";

/** Sends a test notification to the signed-in user's own devices. */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isEmailAllowed(user.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ error: "Push is not configured on the server" }, { status: 503 });
  const { data } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth");
  const subs = (data ?? []) as PushTarget[];
  let sent = 0;
  for (const s of subs) {
    const r = await sendPush(s, { title: "DevSprint 60", body: "Push reminders are working.", url: "/dashboard", tag: "test" });
    if (r === "ok") sent += 1;
    if (r === "gone") await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
  }
  return NextResponse.json({ sent });
}
