"use client";
import Link from "next/link";
import { useTheme } from "next-themes";
import { LogOut, Menu, Moon, Sun, Settings } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NAV } from "@/lib/nav";
import { signOut } from "@/app/actions/auth";
import { NotificationBell } from "./notification-bell";
import { NetworkStatus } from "./network-status";
import type { NotificationRow } from "@/lib/types";

export function Header({ dateLabel, name, email, avatarUrl, notifications }: {
  dateLabel: string; name: string; email: string; avatarUrl: string | null; notifications: NotificationRow[];
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-6">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu"><Menu /></Button>
        </DialogTrigger>
        <DialogContent className="top-0 left-0 h-dvh max-h-dvh w-72 translate-x-0 translate-y-0 rounded-none">
          <DialogTitle>Menu</DialogTitle>
          <nav className="flex flex-col gap-4">
            {NAV.map((g) => (
              <div key={g.group} className="flex flex-col">
                <p className="pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{g.group}</p>
                {g.items.map((i) => (
                  <Link key={i.href} href={i.href} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent">
                    <i.icon className="h-4 w-4" />{i.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </DialogContent>
      </Dialog>

      <p className="truncate text-sm text-muted-foreground">{dateLabel}</p>
      <div className="ml-auto flex items-center gap-1">
        <NetworkStatus />
        <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
          {resolvedTheme === "dark" ? <Sun /> : <Moon />}
        </Button>
        <NotificationBell initial={notifications} />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button aria-label="Account" className="ml-1 grid h-8 w-8 place-items-center overflow-hidden rounded-full border bg-muted text-xs font-medium">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : initials}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-52 rounded-md border bg-card p-1 text-sm shadow-lg">
              <div className="px-2 py-1.5">
                <p className="font-medium">{name}</p>
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item asChild>
                <Link href="/settings" className="flex items-center gap-2 rounded px-2 py-1.5 outline-none data-[highlighted]:bg-accent"><Settings className="h-4 w-4" />Settings</Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => void signOut()} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none data-[highlighted]:bg-accent">
                <LogOut className="h-4 w-4" />Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
