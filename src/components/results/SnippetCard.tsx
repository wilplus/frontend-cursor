"use client";

import { ChevronRight, Droplet, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import MediaPlayer from "@/components/results/MediaPlayer";
import type { AcousticMetric } from "@/components/results/AcousticToggle";

/**
 * Voice-Journey snippet shape consumed by the user-facing cards.
 *
 * Backend keys are mapped at the page level (see deriveSnippet in
 * src/app/results/[sessionId]/page.tsx) into this presentation shape
 * so the card component never has to know about snake_case API
 * fields.
 *
 * Note: `metrics` is still part of the shape for backwards-compat with
 * the page-level mapper, but the public card no longer renders them —
 * decision-fatigue cleanup per the Infinite Coaching Loop spec.
 * Acoustic data still flows to the admin surface, just hidden here.
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

/**
 * Public-facing snippet card — the user-side rendering of one
 * coach-pulled moment from a session.
 *
 * This card is deliberately minimal per the Infinite Coaching Loop
 * spec: type badge, the coach's insight, the audio, and ONE CTA.
 * No collapsible acoustic-metrics row, no progress strip, no
 * secondary actions — the user has exactly one decision to make
 * (start the next contextual chat or not), so there's exactly one
 * button.
 *
 * The CTA always reads "Start next conversation based on this" and
 * navigates to /chat?sourceSnippet=<id>&intent=<charisma|stress>.
 * The intent is forwarded so the backend can seed the right tone
 * (warm vs cool) for the contextual chat's first question.
 */
export default function SnippetCard({
  snippet,
  animationDelayMs = 0,
}: SnippetCardProps) {
  const isCharisma = snippet.type === "charisma";
  // Same glyph in the badge and the CTA so the two reinforce each other
  // visually (the user pattern-matches "flame = charisma" / "droplet =
  // stress" within a single card).
  const TypeIcon = isCharisma ? Flame : Droplet;

  return (
    <article
      className="animate-fade-in-up rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      {/* Top row: badge (left) + duration (right) */}
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            isCharisma
              ? // Spec exception: emerald is the only raw-Tailwind colour
                // allowed (no green token in the design system).
                "bg-emerald-100 text-emerald-800"
              : "border border-destructive/30 bg-destructive/5 text-destructive"
          )}
        >
          <TypeIcon className="h-3.5 w-3.5 fill-current" aria-hidden />
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

      {/* Single CTA — primary brand button, full-width on mobile so
          the user's one decision sits dead-centre. Charisma stays
          orange-filled; stress flips to a destructive-tinted outline
          so the visual valence still tracks the snippet type, but
          there's no longer a "secondary action" anywhere on the card.
          The CTA copy is uniform across both types per spec ("Start
          next conversation based on this") — keeping the loop semantic
          rather than the per-type copy from the previous design. */}
      <div className="mt-6">
        <Button
          asChild
          size="lg"
          variant={isCharisma ? "default" : "outline"}
          className={cn(
            "group w-full justify-center gap-2 rounded-full text-sm font-semibold sm:w-auto sm:px-7",
            isCharisma
              ? "bg-primary text-primary-foreground hover:bg-primary hover:shadow-lg"
              : "border-foreground/20 text-foreground hover:bg-foreground hover:text-primary-foreground"
          )}
        >
          <a
            href={`/chat?sourceSnippet=${encodeURIComponent(snippet.id)}&intent=${encodeURIComponent(snippet.type)}`}
          >
            <TypeIcon className="h-4 w-4 fill-current" aria-hidden />
            Start next conversation based on this
            <ChevronRight
              aria-hidden
              className="ml-0.5 h-4 w-4 transition-transform group-hover:translate-x-[2px]"
            />
          </a>
        </Button>
      </div>
    </article>
  );
}
