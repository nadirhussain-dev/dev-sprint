import "server-only";
import webpush from "web-push";
import { publicEnv, serverEnv } from "@/lib/env";

export function isPushConfigured(): boolean {
  const env = serverEnv();
  return Boolean(publicEnv.vapidPublicKey && env.vapidPrivateKey);
}

let configured = false;
function configure() {
  if (configured) return;
  const env = serverEnv();
  webpush.setVapidDetails(env.vapidSubject, publicEnv.vapidPublicKey, env.vapidPrivateKey);
  configured = true;
}

export interface PushTarget { endpoint: string; p256dh: string; auth: string }
export interface PushPayload { title: string; body: string; url: string; tag?: string }

/** Sends one notification. Returns "gone" for expired subscriptions so callers can delete them. */
export async function sendPush(sub: PushTarget, payload: PushPayload): Promise<"ok" | "gone" | "error"> {
  configure();
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 60 * 60 });
    return "ok";
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    return code === 404 || code === 410 ? "gone" : "error";
  }
}
