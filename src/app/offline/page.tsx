import { WifiOff } from "lucide-react";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <WifiOff className="h-6 w-6 text-muted-foreground" />
      <h1 className="text-lg font-semibold">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Pages you&apos;ve already opened still work, and task changes you make are queued and synced when you reconnect.
      </p>
      <a href="/dashboard" className="text-sm underline">Try again</a>
    </main>
  );
}
