"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import MediaPlayer from "@/components/results/MediaPlayer";
import AcousticToggle, {
  type AcousticMetric,
} from "@/components/results/AcousticToggle";

/**
 * Voice-Journey snippet shape consumed by the user-facing cards.
 *
 * Backend keys are mapped at the page level (see deriveSnippet in
 * src/app/results/[sessionId]/page.tsx) into this presentation shape
 * so the card component never has to know about snake_case API
 * fields.
 */
export interface JourneySnippet {
  id: string;
  type: "charisma" | "stress";
  badgeLabel: string;
  duration: string;
  insight: string;
  ctaLabel: string;
  metrics: AcousticMetric[];
  /** Resolved playable URL (may be null on lookup failure). */
  audioUrl: string | null;
  /** Slice start inside the source file (ms). */
  startOffsetMs: number;
  /** Slice duration (ms). */
  durationMs: number;
}

interface SnippetCardProps {
  snippet: JourneySnippet;
  /** Inline `animationDelay` (ms) so the page can stagger entrances. */
  animationDelayMs?: number;
}

export default function SnippetCard({
  snippet,
  animationDelayMs = 0,
}: SnippetCardProps) {
  const isCharisma = snippet.type === "charisma";

  return (
    <article
      className="animate-fade-in-up rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      {/* Top row: badge (left) + duration (right) */}
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
            isCharisma
              ? // Spec exception: emerald is the only raw-Tailwind colour
                // allowed (no green token in the design system).
                "bg-emerald-100 text-emerald-800"
              : "border border-destructive/30 bg-destructive/5 text-destructive"
          )}
        >
          {snippet.badgeLabel}
        </span>
        <span className="text-xs text-muted-foreground">{snippet.duration}</span>
      </div>

      {/* Coach's Insight */}
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Coach&apos;s Insight
      </p>
      <p className="mt-1 text-base leading-relaxed text-foreground">
        {snippet.insight}
      </p>

      {/* Media player — clamps to start_offset_ms / duration_ms when
          the URL is a concat'd full.webm file. */}
      <div className="mt-5">
        <MediaPlayer
          src={snippet.audioUrl}
          startOffsetMs={snippet.startOffsetMs}
          durationMs={snippet.durationMs}
        />
      </div>

      {/* Progressive-disclosure metrics */}
      <AcousticToggle
        metrics={snippet.metrics}
        panelId={`acoustic-${snippet.id}`}
      />

      {/* Hairline + right-aligned CTA */}
      <hr className="mt-5 border-border" />
      <div className="mt-4 flex justify-end">
        {isCharisma ? (
          <Button
            asChild
            className="group rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary hover:shadow-lg"
          >
            <a
              href={`/chat?sourceSnippet=${encodeURIComponent(
                snippet.id
              )}&intent=charisma`}
            >
              {snippet.ctaLabel}
              <ChevronRight
                aria-hidden
                className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-[2px]"
              />
            </a>
          </Button>
        ) : (
          <Button
            asChild
            variant="outline"
            className="group rounded-full border-foreground/20 px-5 text-foreground hover:bg-foreground hover:text-primary-foreground"
          >
            <a
              href={`/chat?sourceSnippet=${encodeURIComponent(
                snippet.id
              )}&intent=stress`}
            >
              {snippet.ctaLabel}
              <ChevronRight
                aria-hidden
                className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-[2px]"
              />
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}
