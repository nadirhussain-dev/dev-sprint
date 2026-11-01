"use client";
import { useEffect, useState, useTransition } from "react";
import { BellRing, CheckCircle2, Download, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { removePushSubscription, savePushSubscription } from "@/app/actions/notifications";
import { getRegistration, urlBase64ToUint8Array } from "@/lib/push/client";
import { Button } from "@/components/ui/button";

type State = "checking" | "unsupported" | "not_configured" | "denied" | "off" | "on";

export function PushSetup({ vapidPublicKey, serverPushReady, deviceCount }: { vapidPublicKey: string; serverPushReady: boolean; deviceCount: number }) {
  const [state, setState] = useState<State>("checking");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (!vapidPublicKey || !serverPushReady) return setState("not_configured");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setEndpoint(sub?.endpoint ?? null);
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [vapidPublicKey, serverPushReady]);

  const enable = () => start(async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState(permission === "denied" ? "denied" : "off"); return; }
      const reg = await getRegistration();
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) });
      const res = await savePushSubscription(sub.toJSON(), navigator.userAgent);
      if (!res.ok) { toast.error(res.error); return; }
      setEndpoint(sub.endpoint); setState("on");
      toast.success("Push reminders enabled on this device");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't enable push");
    }
  });

  const disable = () => start(async () => {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
    if (endpoint) await removePushSubscription(endpoint);
    setEndpoint(null); setState("off");
    toast("Push disabled on this device");
  });

  const test = () => start(async () => {
    const res = await fetch("/api/push/test", { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { sent?: number; error?: string };
    if (!res.ok) toast.error(body.error ?? "Test failed"); else toast.success(`Sent to ${body.sent} device${body.sent === 1 ? "" : "s"}`);
  });

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="flex items-start gap-2 rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        In-app reminders always work: whenever you open DevSprint, any reminder whose time has passed today appears in the bell.
        Background push (when the app is closed) needs VAPID keys and a scheduler calling <code className="font-mono">/api/cron/reminders</code> — see the README.
      </p>
      {state === "checking" ? <p className="text-muted-foreground">Checking this device…</p> : null}
      {state === "unsupported" ? <p className="text-muted-foreground">This browser doesn&apos;t support web push. On iPhone, install the app to your home screen first (iOS 16.4+).</p> : null}
      {state === "not_configured" ? (
        <div className="flex flex-col gap-1">
          <p className="font-medium">Push isn&apos;t configured on the server yet</p>
          <ol className="list-decimal pl-5 text-xs text-muted-foreground">
            <li>Run <code className="font-mono">npm run vapid</code> and set <code className="font-mono">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>, <code className="font-mono">VAPID_PRIVATE_KEY</code>, <code className="font-mono">VAPID_SUBJECT</code>.</li>
            <li>Set <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> and <code className="font-mono">CRON_SECRET</code>.</li>
            <li>Schedule a call to <code className="font-mono">/api/cron/reminders</code> every 15 minutes (Supabase pg_cron SQL is in the README).</li>
          </ol>
        </div>
      ) : null}
      {state === "denied" ? <p className="text-muted-foreground">Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then reload.</p> : null}
      {state === "off" ? <Button onClick={enable} disabled={pending} className="self-start">{pending ? <Loader2 className="animate-spin" /> : <BellRing />}Enable push on this device</Button> : null}
      {state === "on" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-success"><CheckCircle2 className="h-4 w-4" />Enabled on this device</span>
          <Button size="sm" variant="outline" onClick={test} disabled={pending}>Send test</Button>
          <Button size="sm" variant="ghost" onClick={disable} disabled={pending}>Disable</Button>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">{deviceCount} device{deviceCount === 1 ? "" : "s"} subscribed.</p>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

export function InstallApp() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BeforeInstallPromptEvent); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  if (installed) return <p className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="h-4 w-4" />Running as an installed app</p>;
  if (evt) return <Button onClick={async () => { await evt.prompt(); const c = await evt.userChoice; if (c.outcome === "accepted") setInstalled(true); setEvt(null); }}><Download />Install DevSprint 60</Button>;
  return <p className="text-sm text-muted-foreground">To install: use your browser&apos;s “Install app” / “Add to Home Screen” option (Safari: Share → Add to Home Screen).</p>;
}
