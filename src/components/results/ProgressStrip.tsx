"use client";

import { useEffect, useState } from "react";
import { ChevronDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Backend response shape                                                    */
/* -------------------------------------------------------------------------- */

interface Attempt {
  attempt_number: number;
  score: number | null;
  components: Record<string, number> | null;
  user_answer_word_count: number | null;
  user_answer_duration_ms: number | null;
  source: string | null;
  is_eligible_for_few_shot: boolean | null;
  self_rating: number | null;
  self_rating_text: string | null;
  self_rating_submitted_at: string | null;
  entities: unknown;
  created_at: string;
}

interface Delta {
  best_attempt_number: number | null;
  first_score: number | null;
  best_score: number | null;
  score: number | null;
  word_count: number | null;
  duration_ms: number | null;
  self_rating_first: number | null;
  self_rating_best: number | null;
}

interface ProgressPayload {
  snippet_id: string;
  attempts: Attempt[];
  delta: Delta | null;
}

interface ProgressStripProps {
  snippetId: string;
}

/**
 * "Your progress on this" strip — sits under each SnippetCard on the
 * Voice-Journey timeline. Fetches `/api/v2/user/coaching/progress` on
 * mount and renders three at-a-glance signals:
 *
 *   • attempt count                  ("3 attempts")
 *   • first → best score delta       ("+0.18", green when positive)
 *   • self-rating progression        ("6 → 9", when both ratings exist)
 *
 * Clicking expands a timeline of every attempt with its score,
 * top components, and self-rating + timestamp.
 *
 * Empty `attempts` array → render nothing (no strip, no skeleton —
 * the user hasn't tried this snippet yet so there's nothing to show).
 * `delta` null → show count only.
 */
export default function ProgressStrip({ snippetId }: ProgressStripProps) {
  const [payload, setPayload] = useState<ProgressPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(
          `/api/v2/user/coaching/progress?snippet_id=${encodeURIComponent(
            snippetId
          )}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          // Soft-fail: progress is a nice-to-have, not load-blocking.
          // 401/404/anything → just skip the strip silently.
          if (!cancelled) setLoading(false);
          return;
        }
        const data = (await res.json()) as ProgressPayload;
        if (!cancelled) {
          setPayload(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [snippetId]);

  // Hide while loading (don't flash a skeleton) and when the user
  // has zero attempts on this snippet.
  if (loading) return null;
  if (!payload) return null;
  if (payload.attempts.length === 0) return null;

  const count = payload.attempts.length;
  const delta = payload.delta;

  // Score delta first → best. Backend gives both anchors; we display
  // the signed difference so positive growth pops in green.
  const scoreDelta =
    delta?.first_score != null && delta?.best_score != null
      ? delta.best_score - delta.first_score
      : null;

  // Self-rating progression — only show when both anchors exist.
  // The "first" anchor is always present once any rating lands; the
  // "best" only differs once a later attempt scored higher.
  const ratingFirst = delta?.self_rating_first;
  const ratingBest = delta?.self_rating_best;
  const showRatingArrow =
    ratingFirst != null && ratingBest != null && ratingFirst !== ratingBest;

  return (
    <div className="mt-3 rounded-xl border border-border bg-card/50 px-4 py-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 text-left"
      >
        <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />

        <span className="text-xs font-medium text-foreground">
          Your progress on this
        </span>

        <div className="ml-auto flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
          <span>
            {count} attempt{count === 1 ? "" : "s"}
          </span>

          {scoreDelta != null && (
            <span
              className={cn(
                "font-medium",
                scoreDelta > 0
                  ? "text-emerald-700"
                  : scoreDelta < 0
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              {scoreDelta > 0 ? "+" : ""}
              {scoreDelta.toFixed(2)}
            </span>
          )}

          {showRatingArrow && (
            <span>
              {ratingFirst} → {ratingBest}
            </span>
          )}
        </div>

        <ChevronDown
          aria-hidden
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {/* Expanded timeline — uses the CSS-grid 0fr↔1fr trick so the
          reveal is smooth without JS height measurement. */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <ol className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
            {payload.attempts.map((a) => (
              <li
                key={a.attempt_number}
                className="flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      Attempt {a.attempt_number}
                    </span>
                    {a.score != null && (
                      <span className="tabular-nums text-muted-foreground">
                        score {a.score.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {a.components && Object.keys(a.components).length > 0 && (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {Object.entries(a.components)
                        .slice(0, 3)
                        .map(
                          ([k, v]) =>
                            `${k}: ${typeof v === "number" ? v.toFixed(2) : v}`
                        )
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                  {a.self_rating != null && (
                    <div className="tabular-nums text-foreground">
                      rated {a.self_rating}/10
                    </div>
                  )}
                  <div>{formatRelative(a.created_at)}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Time helpers                                                              */
/* -------------------------------------------------------------------------- */

/** "3 days ago" / "just now" style relative time. Browser-side only —
 *  the strip is a client component so hydration mismatch isn't a risk. */
function formatRelative(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const delta = Date.now() - then;
    const sec = Math.max(0, Math.floor(delta / 1000));
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}
