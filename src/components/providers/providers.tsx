"use client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { ServiceWorkerRegistrar } from "./sw-registrar";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster position="bottom-right" toastOptions={{ classNames: { toast: "!bg-card !text-card-foreground !border-border" } }} />
      <ServiceWorkerRegistrar />
    </ThemeProvider>
  );
}
