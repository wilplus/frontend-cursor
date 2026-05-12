"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import AcousticToggle from "@/components/results/journey/AcousticToggle";
import MediaPlayer from "@/components/results/journey/MediaPlayer";
import type { Snippet } from "@/lib/results/types";

/** Back-compat alias — preferred name is `Snippet` from @/lib/results/types. */
export type JourneySnippet = Snippet;

interface JourneySnippetCardProps {
  snippet: Snippet;
  /** Index used to stagger the fade-in-up entrance. */
  index?: number;
}

/**
 * Voice-Journey snippet card. Pixel-spec layout:
 *   1. Top row    — coloured badge (left)  +  duration label (right)
 *   2. MediaPlayer (its own component, see ./MediaPlayer.tsx)
 *   3. Coach's Insight — uppercase tracking-wider muted label + body
 *   4. AcousticToggle — progressive disclosure of numeric metrics
 *   5. <hr/> separator + right-aligned CTA pill (chevron translates on hover)
 *
 * The CTA navigates to /chat?sourceSnippet={id}&intent={type} per spec —
 * the contextual "Infinite Retention Loop" hand-off into a follow-up
 * coaching turn.
 */
export default function JourneySnippetCard({
  snippet,
  index = 0,
}: JourneySnippetCardProps) {
  const isCharisma = snippet.type === "charisma";

  // Spec asks for staggered fade-in: i * 120ms + 120ms.
  const animationDelay = `${index * 120 + 120}ms`;

  const handleClick = () => {
    window.location.href = `/chat?sourceSnippet=${encodeURIComponent(
      snippet.id
    )}&intent=${encodeURIComponent(snippet.type)}`;
  };

  return (
    <article
      className="animate-fade-in-up rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
      style={{ animationDelay }}
    >
      {/* 1. Top row: badge + duration */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
            isCharisma
              ? // Spec exception: solid emerald is the only allowed
                // raw-Tailwind colour because the design system has
                // no green token.
                "bg-emerald-100 text-emerald-800"
              : "border border-destructive/30 bg-destructive/5 text-destructive"
          )}
        >
          {snippet.badgeLabel}
        </span>
        <span className="text-xs text-muted-foreground">{snippet.duration}</span>
      </div>

      {/* 2. Media player */}
      <div className="mb-5">
        <MediaPlayer audioUrl={snippet.audioUrl} duration={snippet.duration} />
      </div>

      {/* 3. Coach's Insight */}
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Coach&apos;s Insight
        </p>
        <p className="mt-1.5 text-base leading-relaxed text-foreground">
          {snippet.insight}
        </p>
      </div>

      {/* 4. Progressive-disclosure acoustic metrics */}
      <div className="mb-5">
        <AcousticToggle
          metrics={snippet.metrics}
          panelId={`acoustic-${snippet.id}`}
        />
      </div>

      {/* 5. Hairline + right-aligned CTA */}
      <hr className="border-border" />
      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            "group inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all hover:shadow-lg",
            isCharisma
              ? "bg-primary text-primary-foreground"
              : "border border-foreground/20 bg-card text-foreground hover:bg-foreground hover:text-primary-foreground"
          )}
        >
          {snippet.ctaLabel}
          <ChevronRight
            aria-hidden
            className="h-4 w-4 transition-transform group-hover:translate-x-[2px]"
          />
        </button>
      </div>
    </article>
  );
}
