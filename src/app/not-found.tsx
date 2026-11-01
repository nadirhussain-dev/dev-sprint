import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 text-center">
      <p className="font-mono text-xs text-muted-foreground">404</p>
      <h1 className="text-lg font-semibold">Page not found</h1>
      <Link href="/dashboard" className="text-sm underline">Back to today</Link>
    </main>
  );
}
