"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, BookOpen, ListVideo } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/exercises", label: "Exercises", icon: BookOpen },
  { href: "/admin/recordings", label: "Recordings", icon: ListVideo },
];

export default function AdminShell({
  children,
  email,
  onLogout,
}: {
  children: React.ReactNode;
  email?: string | null;
  onLogout?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background admin-panel">
      <header className="sticky top-0 z-10 h-14 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <span className="text-lg font-bold text-foreground">Admin</span>
          <nav className="flex flex-1 items-center justify-center gap-1 overflow-x-auto py-2 md:overflow-visible">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                  pathname === href || pathname.startsWith(href + "/")
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {email && (
              <span className="hidden max-w-[180px] truncate text-sm text-muted-foreground sm:inline">
                {email}
              </span>
            )}
            {onLogout && (
              <Button type="button" variant="outline" size="sm" onClick={onLogout}>
                Logout
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 md:p-6">
        <div className="animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
