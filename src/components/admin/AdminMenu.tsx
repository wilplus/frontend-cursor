"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle, BookOpen, CalendarDays, FlaskConical, Home,
  Menu, PanelLeft, Target, Trash2, TrendingUp, Users, X,
} from "lucide-react";
import Logo from "@/components/Logo";
import { probeAdmin, rememberedAdmin } from "@/components/admin/AdminGate";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  AdminMenu — one menu around every admin page (founder 2026-10-14, from the  */
/*  approved admin-panel prototype). Left column on a computer, collapsible to  */
/*  icons; on a phone a top bar with a menu button that slides it in. The pages */
/*  themselves stay as they are. Shown only to an admin (same probe as          */
/*  AdminGate); every page and endpoint still checks for itself.                */
/* -------------------------------------------------------------------------- */

type Item = [href: string, label: string, Icon: typeof Home];

const GROUPS: [string, Item[]][] = [
  ["Overview", [["/admin/ceo", "CEO", Home]]],
  ["People", [
    ["/admin/users", "Users", Users],
    ["/admin/booking", "Bookings", CalendarDays],
  ]],
  ["Product", [
    ["/admin/rings", "Rings", Target],
    ["/admin/pace", "Pace", TrendingUp],
    ["/admin/research", "Research", FlaskConical],
  ]],
  ["Coaching", [
    ["/admin/library", "Exercise library", BookOpen],
    ["/admin/errors", "Speaking errors", AlertTriangle],
  ]],
  ["Data", [["/admin/project-deletions", "Project deletions", Trash2]]],
];

const COLLAPSED_KEY = "willab:admin-menu-collapsed";

export default function AdminMenu({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const [admin, setAdmin] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (rememberedAdmin()) setAdmin(true);
    let live = true;
    void probeAdmin().then((ok) => live && setAdmin(ok));
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      /* storage blocked: menu starts open */
    }
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  if (!admin) return <>{children}</>;

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1");
      } catch {
        /* not remembered */
      }
      return !c;
    });
  };

  const nav = (
    <nav aria-label="Admin" className="flex h-full flex-col gap-4 overflow-y-auto px-2.5 py-3.5">
      {GROUPS.map(([title, items]) => (
        <div key={title} className="grid gap-0.5">
          <h4 className={cn("px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground", collapsed && "md:hidden")}>
            {title}
          </h4>
          {items.map(([href, label, Icon]) => {
            const current = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={href} href={href} title={label} aria-current={current ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 whitespace-nowrap rounded-[10px] px-2.5 py-2 text-sm font-medium text-muted-foreground no-underline hover:bg-muted hover:text-foreground",
                  current && "bg-muted text-foreground",
                  collapsed && "md:justify-center"
                )}>
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                <span className={cn(collapsed && "md:hidden")}>{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
      <button type="button" onClick={toggleCollapsed} title="Collapse menu"
        className={cn("mt-auto hidden items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground md:flex", collapsed && "justify-center")}>
        <PanelLeft className="h-[18px] w-[18px] shrink-0" aria-hidden />
        <span className={cn(collapsed && "hidden")}>Collapse menu</span>
      </button>
    </nav>
  );

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Phone: a top bar with the menu button. */}
      <div className="sticky top-0 z-20 flex h-14 items-center gap-2.5 border-b border-border bg-background px-4 md:hidden">
        <button type="button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-[10px] hover:bg-muted">
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <Logo size="sm" />
        <span className="rounded-full border border-border px-2 text-[13px] font-medium text-muted-foreground">Admin</span>
      </div>
      {open && (
        <div className="fixed inset-0 z-30 md:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/35" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] border-r border-border bg-background">
            <button type="button" aria-label="Close menu" onClick={() => setOpen(false)}
              className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-[10px] hover:bg-muted">
              <X className="h-5 w-5" aria-hidden />
            </button>
            {nav}
          </div>
        </div>
      )}
      {/* Computer: the left column. */}
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 border-r border-border md:block", collapsed ? "w-16" : "w-60")}>
        {nav}
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
