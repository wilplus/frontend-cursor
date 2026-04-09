"use client";

import type { UserSniperProfile } from "@/lib/sniper/types";

interface Step0WaitingCardProps {
  message: string;
  sniperProfile: UserSniperProfile | null;
}

export default function Step0WaitingCard({ message, sniperProfile }: Step0WaitingCardProps) {
  return (
    <div className="w-full rounded-3xl border border-border bg-muted/40 px-5 py-6 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 6v6l4 2" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <div className="mt-4 space-y-3">
        <p className="text-xl font-semibold text-foreground">Homework submitted!</p>
        <p className="text-sm leading-6 text-muted-foreground">{message}</p>
        {(sniperProfile?.realtime_level != null || sniperProfile?.realtime_step != null) ? (
          <div className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-foreground">
            Current unlocked progress: Level {sniperProfile?.realtime_level ?? "—"}, Step{" "}
            {sniperProfile?.realtime_step ?? "—"}
          </div>
        ) : null}
      </div>
    </div>
  );
}
