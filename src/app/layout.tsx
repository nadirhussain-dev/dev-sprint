import type { Metadata, Viewport } from "next";
import { Comfortaa } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/components/providers/providers";
import "./globals.css";

const comfortaa = Comfortaa({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-comfortaa", display: "swap" });

export const metadata: Metadata = {
  title: { default: "DevSprint", template: "%s · DevSprint" },
  description: "A 90-day full-stack + AI engineering study tracker.",
  applicationName: "DevSprint",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "DevSprint", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6fdf7" },
    { media: "(prefers-color-scheme: dark)", color: "#07110b" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${comfortaa.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
