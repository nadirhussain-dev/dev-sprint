import { getAppContext } from "@/lib/data/context";
import { syncInAppReminders } from "@/lib/data/reminders";
import { formatLongDate } from "@/lib/domain/dates";
import { Sidebar, MobileNav } from "@/components/shell/sidebar";
import { Header } from "@/components/shell/header";
import { OfflineSync } from "@/components/shell/offline-sync";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  const notifications = await syncInAppReminders(ctx).catch(() => []);
  const dayLabel =
    ctx.position.phase === "active" ? `DAY ${ctx.position.dayNumber} / 60`
    : ctx.position.phase === "not_started" ? `STARTS IN ${ctx.position.daysUntilStart}D`
    : "SPRINT COMPLETE";

  return (
    <div className="flex min-h-dvh">
      <Sidebar dayLabel={dayLabel} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          dateLabel={formatLongDate(ctx.today)}
          name={ctx.profile.full_name ?? ctx.email}
          email={ctx.email}
          avatarUrl={ctx.profile.avatar_url}
          notifications={notifications}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-6 md:pb-10">{children}</main>
      </div>
      <MobileNav />
      <OfflineSync />
    </div>
  );
}
