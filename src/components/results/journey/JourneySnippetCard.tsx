"use client";

import Link from "next/link";
import { ChevronRight, Flame, Droplet, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import AcousticToggle, {
  type AcousticMetric,
} from "@/components/results/journey/AcousticToggle";

export interface JourneySnippet {
  id: string;
  type: "charisma" | "stress";
  /** Display duration label, e.g. "0:15". */
  duration: string;
  /** Pill text near the play control, e.g. "Charisma Moment". */
  badgeLabel: string;
  /** Coach's insight body shown under the player. */
  insight: string;
  /** CTA copy on the action button. */
  ctaLabel: string;
  metrics: AcousticMetric[];
  /** Optional: real audio URL when wired. Not required for the mock view. */
  audioUrl?: string;
}

interface JourneySnippetCardProps {
  snippet: JourneySnippet;
  /** Index used to stagger the fade-in-up entrance. */
  index?: number;
}

/**
 * Snippet card on the user-facing Voice Journey page.
 *
 * Distinct from `src/components/results/SnippetCard.tsx` (which is the
 * single-session view). This one is part of the "Infinite Retention Loop":
 * its CTA routes back into a contextual chat session at
 * /chat?sourceSnippet={id}&intent={type}. (Note: the /chat route itself
 * isn't built yet — links resolve to a 404 until that ships.)
 */
export default function JourneySnippetCard({
  snippet,
  index = 0,
}: JourneySnippetCardProps) {
  const isCharisma = snippet.type === "charisma";
  const Icon = isCharisma ? Flame : Droplet;

  return (
    <article
      className="animate-fade-in-up rounded-2xl border border-border bg-card p-5 shadow-sm"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Top: badge */}
      <div className="mb-4 flex items-center gap-2">
        <Badge variant={isCharisma ? "success" : "destructive"}>
          <Icon className="h-3 w-3" aria-hidden />
          {snippet.badgeLabel}
        </Badge>
      </div>

      {/* Media player placeholder (uses native audio when audioUrl is set) */}
      <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3">
        {snippet.audioUrl ? (
          <audio
            controls
            src={snippet.audioUrl}
            controlsList="nodownload"
            className="w-full"
          />
        ) : (
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Play className="h-4 w-4 fill-current" aria-hidden />
            </span>
            <div className="h-1.5 flex-1 rounded-full bg-border">
              <div className="h-full w-1/3 rounded-full bg-primary" />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {snippet.duration}
            </span>
          </div>
        )}
      </div>

      {/* Coach's Insight */}
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Coach&apos;s Insight
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground">
          {snippet.insight}
        </p>
      </div>

      {/* Acoustic data toggle */}
      <div className="mb-4">
        <AcousticToggle
          metrics={snippet.metrics}
          panelId={`acoustic-${snippet.id}`}
        />
      </div>

      {/* Footer separator + action */}
      <div className="border-t border-border pt-4">
        <Link
          href={`/chat?sourceSnippet=${encodeURIComponent(
            snippet.id
          )}&intent=${snippet.type}`}
          className={cn(
            "group inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium shadow-sm transition-all",
            isCharisma
              ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg"
              : "border border-destructive/30 bg-card text-destructive hover:bg-destructive/10 hover:shadow-lg"
          )}
        >
          {snippet.ctaLabel}
          <ChevronRight
            aria-hidden
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </article>
  );
}
