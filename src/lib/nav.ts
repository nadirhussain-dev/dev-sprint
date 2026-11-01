import {
  BarChart3, BookOpenCheck, CalendarDays, Code2, FolderKanban, LayoutDashboard, Map, Mic, Network, RotateCcw, Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem { href: string; label: string; icon: LucideIcon; mobile?: boolean }

export const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Daily", items: [
    { href: "/dashboard", label: "Today", icon: LayoutDashboard, mobile: true },
    { href: "/roadmap", label: "Roadmap", icon: Map, mobile: true },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/revision", label: "Revision", icon: RotateCcw, mobile: true },
  ] },
  { group: "Practice", items: [
    { href: "/simulator", label: "Simulator", icon: Mic, mobile: true },
    { href: "/questions", label: "Question bank", icon: BookOpenCheck },
    { href: "/coding", label: "Coding", icon: Code2 },
    { href: "/system-design", label: "System design", icon: Network },
    { href: "/projects", label: "Project", icon: FolderKanban },
  ] },
  { group: "Insights", items: [
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/settings", label: "Settings", icon: Settings },
  ] },
];
