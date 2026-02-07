"use client";

import { Button } from "@/components/ui/button";

/**
 * Admin shell: only the "Students" tab is in the nav. Tasks, questions, and metrics
 * are managed inside each student profile (modals), not as separate tabs.
 */
export default function AdminShell({
  children,
  email,
  onLogout,
}: {
  children: React.ReactNode;
  email?: string | null;
  onLogout?: () => void;
}) {
  return (
    <div className="min-h-screen bg-background admin-panel">
      <header className="sticky top-0 z-10 h-14 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <span className="text-lg font-bold text-foreground">Admin</span>
          <div className="flex items-center gap-2">
            {email && (
              <span className="max-w-[200px] truncate text-sm text-muted-foreground sm:max-w-[280px]">
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
