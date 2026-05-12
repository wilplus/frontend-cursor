"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Eye, Loader2, RotateCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Backend response shapes                                                   */
/* -------------------------------------------------------------------------- */

interface Mirror {
  version: number;
  generated_at: string;
  model: string;
  based_on_attempts: number;
  headline: string;
  narrative: string;
  observations: string[];
}

interface MirrorGetPayload {
  feature_enabled: boolean;
  mirror: Mirror | null;
  generated_at: string | null;
}

interface MirrorGeneratePayload {
  mirror: Mirror;
  generated_at: string;
}

/* -------------------------------------------------------------------------- */
/*  Error code → user-facing copy (single source of truth)                    */
/* -------------------------------------------------------------------------- */

const ERROR_COPY: Record<string, string> = {
  NOT_ENOUGH_DATA:
    "Keep practising — I need at least 3 attempts before I can tell you what I see.",
  PROFILE_MISSING: "Record one coaching answer first.",
  LLM_UNAVAILABLE: "Coach is offline — try again later.",
  LLM_ERROR: "Something glitched, try again in a moment.",
  PERSIST_FAILED: "Generated but couldn't save; retry.",
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * "Show me what you're noticing about me" — top-of-/results CTA that
 * generates (and re-generates) the user's coaching mirror.
 *
 * Page-load lifecycle:
 *   1. GET /api/v2/user/mirror to check feature_enabled + fetch any
 *      existing mirror.
 *   2. feature_enabled === false → render nothing (button absent —
 *      not a "coming soon" placeholder).
 *   3. existing mirror → render the card immediately + show the
 *      button as a "Regenerate" affordance instead of the first-run
 *      CTA. Hint line "Last generated: 6 days ago" sits below.
 *
 * Click → POST /api/v2/user/mirror/generate, with loading copy
 * "Reading your last few conversations…". Error codes map to the
 * canonical user-facing copy above. FEATURE_DISABLED retroactively
 * hides the whole panel (handles the case where the flag flips off
 * mid-session).
 */
export default function MirrorPanel() {
  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);
  const [mirror, setMirror] = useState<Mirror | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [obsOpen, setObsOpen] = useState(false);

  // Page-load probe: feature flag + existing mirror.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/v2/user/mirror", { cache: "no-store" });
        if (!res.ok) {
          // Treat any non-200 as "feature unavailable" for now — the
          // panel just stays hidden. Surfacing a banner here would
          // distract from the timeline.
          if (!cancelled) setFeatureEnabled(false);
          return;
        }
        const data = (await res.json()) as MirrorGetPayload;
        if (cancelled) return;
        setFeatureEnabled(!!data.feature_enabled);
        setMirror(data.mirror ?? null);
      } catch {
        if (!cancelled) setFeatureEnabled(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/v2/user/mirror/generate", {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as
        | MirrorGeneratePayload
        | { code?: string; error?: string };

      if (res.ok && "mirror" in data && data.mirror) {
        setMirror(data.mirror);
        setObsOpen(false);
        return;
      }

      const code = (data as { code?: string }).code ?? `HTTP_${res.status}`;

      // FEATURE_DISABLED → flip the panel off retroactively. The flag
      // can change mid-session and the spec says hide the button when
      // we see this.
      if (code === "FEATURE_DISABLED") {
        setFeatureEnabled(false);
        return;
      }

      setError(
        ERROR_COPY[code] ??
          (data as { error?: string }).error ??
          "Couldn't generate your mirror. Try again in a moment."
      );
    } catch (err) {
      console.warn("mirror/generate threw:", err);
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setGenerating(false);
    }
  };

  // Probe in flight or feature flag off → render nothing. We
  // explicitly avoid a "loading…" pill here because the rest of the
  // page is already showing the snippet timeline; a flickering
  // skeleton would feel chatty.
  if (featureEnabled !== true) return null;

  const hasMirror = mirror !== null;

  return (
    <section className="mb-8 animate-fade-in-up" aria-label="Voice coach mirror">
      {/* Trigger button — first-run CTA OR regenerate affordance,
          depending on whether we already have a mirror. */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all",
            hasMirror
              ? "border border-foreground/20 bg-card text-foreground hover:bg-foreground hover:text-primary-foreground"
              : "bg-primary text-primary-foreground hover:shadow-lg",
            "disabled:cursor-wait disabled:opacity-70"
          )}
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : hasMirror ? (
            <RotateCw className="h-4 w-4" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          {generating
            ? "Reading your last few conversations…"
            : hasMirror
            ? "Regenerate"
            : "Show me what you're noticing about me"}
        </button>

        {hasMirror && !generating && (
          <span className="text-xs text-muted-foreground">
            Last generated {formatRelative(mirror.generated_at)}
          </span>
        )}
      </div>

      {error && (
        <p
          className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      {hasMirror && (
        <article className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <header className="mb-3 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <h2 className="font-heading text-2xl leading-tight text-foreground">
              {mirror.headline}
            </h2>
          </header>

          {/* Narrative — preserve paragraph breaks. The backend ships
              double-newline-separated paragraphs. */}
          <div className="space-y-3 text-sm leading-relaxed text-foreground">
            {mirror.narrative.split(/\n{2,}/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          {/* Observations — progressive disclosure via the CSS-grid
              trick. We don't expand by default because the narrative
              already carries the headline; observations are the
              receipts. */}
          {mirror.observations.length > 0 && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setObsOpen((v) => !v)}
                aria-expanded={obsOpen}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
                {obsOpen ? "Hide" : "What I'm reading"}
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    obsOpen && "rotate-180"
                  )}
                />
              </button>
              <div
                className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
                style={{
                  gridTemplateRows: obsOpen ? "1fr" : "0fr",
                  opacity: obsOpen ? 1 : 0,
                }}
              >
                <div className="overflow-hidden">
                  <ul className="mt-3 space-y-1.5 pl-4 text-sm text-muted-foreground">
                    {mirror.observations.map((o, i) => (
                      <li key={i} className="list-disc">
                        {o}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <footer className="mt-5 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
            <span>Generated {formatRelative(mirror.generated_at)}</span>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="font-medium text-foreground underline-offset-2 hover:underline disabled:cursor-wait disabled:opacity-60"
            >
              Regenerate
            </button>
          </footer>
        </article>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Time helpers                                                              */
/* -------------------------------------------------------------------------- */

function formatRelative(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "recently";
    const delta = Date.now() - then;
    const sec = Math.max(0, Math.floor(delta / 1000));
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "recently";
  }
}
