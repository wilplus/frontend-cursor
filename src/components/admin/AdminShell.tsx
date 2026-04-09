"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const studentsActive = pathname?.startsWith("/admin/students");
  const trainingStudioActive =
    pathname?.startsWith("/admin/training-studio") ||
    pathname?.startsWith("/admin/copilot-inbox") ||
    pathname?.startsWith("/admin/acoustic-dojo");
  const voiceLabelingActive = pathname?.startsWith("/admin/voice-labeling");

  return (
    <div className="min-h-screen bg-background admin-panel">
      <header className="sticky top-0 z-10 h-14 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin/students" className="text-lg font-bold text-foreground">
              Admin
            </Link>
            <Link
              href="/admin/students"
              className={`text-sm font-medium transition-colors ${
                studentsActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Students
            </Link>
            <Link
              href="/admin/training-studio"
              className={`text-sm font-medium transition-colors ${
                trainingStudioActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Training Studio
            </Link>
            <Link
              href="/admin/voice-labeling"
              className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                voiceLabelingActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <AudioLines className="h-4 w-4" />
              Voice Labeling
            </Link>
          </div>
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
