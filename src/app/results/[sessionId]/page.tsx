"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import SnippetCard, {
  type JourneySnippet,
} from "@/components/results/SnippetCard";
import type { AcousticMetric } from "@/components/results/AcousticToggle";
import ProcessingState from "@/components/results/ProcessingState";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

/* -------------------------------------------------------------------------- */
/*  Backend response shape                                                    */
/*  Matches the new GET /api/results/[sessionId]/snippets contract: backend   */
/*  guarantees admin_comment is non-empty and audio_url is resolved.          */
/* -------------------------------------------------------------------------- */

interface BackendSnippet {
  id: string;
  snippet_type: "charisma" | "stress" | "unlabeled" | null;
  admin_comment: string;
  audio_url: string | null;
  transcript: string | null;
  turn_number: number | null;
  question_text: string | null;
  question_tone: string | null;
  start_offset_ms: number;
  duration_ms: number;
  metrics: {
    wpm: number | null;
    fillers: number | null;
    pause_ms: number | null;
    dynamic_db: number | null;
    pitch_center: number | null;
    energy: number | null;
  };
}

interface SnippetsPayload {
  status: "ok" | string;
  published: boolean;
  snippets: BackendSnippet[];
}

/* -------------------------------------------------------------------------- */
/*  Multi-session-friendly view model                                         */
/*  The current backend returns snippets for ONE session, so the page wraps   */
/*  them into a one-element Session[] array. That keeps the markup            */
/*  identical to the future multi-session timeline.                           */
/* -------------------------------------------------------------------------- */

interface Session {
  id: string;
  title: string;
  snippets: JourneySnippet[];
}

type ResultsStatus = "processing" | "completed" | "unknown";

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [status, setStatus] = useState<ResultsStatus>("unknown");
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchStatus = async () => {
      try {
        setStatusLoading(true);
        setStatusError(null);

        const response = await fetch(`/api/results/${sessionId}/status`);

        if (response.status === 401) {
          router.push(`/login?redirectTo=/results/${sessionId}`);
          return;
        }
        if (response.status === 403) {
          setStatusError("You do not have access to this session.");
          return;
        }
        if (response.status === 404) {
          setStatusError("Session not found.");
          return;
        }
        if (!response.ok) {
          setStatusError("Failed to load session status.");
          return;
        }

        const data = (await response.json()) as { status?: string };
        if (!cancelled) {
          setStatus(data?.status === "completed" ? "completed" : "processing");
        }
      } catch (err) {
        console.error("Error fetching results status:", err);
        if (!cancelled)
          setStatusError(
            "An error occurred while loading your session status."
          );
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    };

    void fetchStatus();
    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  return (
    <main className="min-h-full bg-background">
      <DashboardHeader />

      {statusLoading && (
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
            </div>
          </div>
        </div>
      )}

      {!statusLoading && statusError && (
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-foreground">{statusError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => router.push("/")}
            >
              Back Home
            </Button>
          </div>
        </div>
      )}

      {!statusLoading && !statusError && status === "processing" && (
        <ProcessingState />
      )}

      {!statusLoading && !statusError && status === "completed" && (
        <CompletedResultsView sessionId={sessionId} />
      )}
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*  Completed view — fetches snippets, maps backend → presentation shape,     */
/*  renders the Voice Journey Timeline (single session for now).              */
/* -------------------------------------------------------------------------- */

function CompletedResultsView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [raw, setRaw] = useState<BackendSnippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSnippets = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/results/${sessionId}/snippets`);

        if (response.status === 401) {
          router.push(`/login?redirectTo=/results/${sessionId}`);
          return;
        }
        if (response.status === 403) {
          setError("You do not have access to this session.");
          return;
        }
        if (response.status === 404) {
          setError("Session not found.");
          return;
        }
        if (!response.ok) {
          setError("Failed to load snippets.");
          return;
        }

        const data = (await response.json()) as SnippetsPayload;
        // Backend already filters to admin_comment-non-empty rows + resolves
        // audio_url. We pass them through verbatim.
        setRaw(Array.isArray(data.snippets) ? data.snippets : []);
      } catch (err) {
        console.error("Error fetching snippets:", err);
        setError("An error occurred while loading your snippets.");
      } finally {
        setLoading(false);
      }
    };

    void fetchSnippets();
  }, [sessionId, router]);

  // Map raw backend rows → JourneySnippet[]. Memoised so the staggered
  // animation delays don't reshuffle on unrelated rerenders.
  const sessions: Session[] = useMemo(() => {
    if (raw.length === 0) return [];
    const snippets = raw.map(deriveSnippet);
    return [
      {
        id: sessionId,
        title: "Your most recent session",
        snippets,
      },
    ];
  }, [raw, sessionId]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="font-heading mb-8 text-4xl text-foreground">
        Your Voice Journey
      </h1>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Loading your snippets…
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-foreground">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.push("/")}
          >
            Back Home
          </Button>
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <p className="mt-6 text-center text-muted-foreground">
          Your coach is still preparing your insights. Check back soon.
        </p>
      )}

      {!loading &&
        !error &&
        sessions.map((session) => (
          <section key={session.id} className="mb-10 last:mb-0">
            <SessionHeader title={session.title} />
            <div className="space-y-5">
              {session.snippets.map((s, i) => (
                <SnippetCard
                  key={s.id}
                  snippet={s}
                  animationDelayMs={i * 120 + 120}
                />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Session header                                                            */
/* -------------------------------------------------------------------------- */

function SessionHeader({ title }: { title: string }) {
  return (
    <div className="mb-6 flex items-baseline gap-4">
      <h2 className="font-heading text-2xl text-foreground">{title}</h2>
      <div className="flex-1 border-t border-border" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Backend → presentation mapping                                            */
/* -------------------------------------------------------------------------- */

function deriveSnippet(s: BackendSnippet): JourneySnippet {
  // `unlabeled` and null both fall through to "charisma" so we never
  // show the spec'd stress badge for an ambiguous row. (The product
  // intent is "missing label = positive default".)
  const type: "charisma" | "stress" =
    s.snippet_type === "stress" ? "stress" : "charisma";

  const badgeLabel = type === "charisma" ? "Charisma" : "Stress Pattern";
  const ctaLabel =
    type === "charisma" ? "Try this hook again" : "Reframe this stressor";

  return {
    id: s.id,
    type,
    badgeLabel,
    duration: `${(s.duration_ms / 1000).toFixed(1)}s`,
    insight: (s.admin_comment ?? "").trim(),
    ctaLabel,
    metrics: buildMetrics(s.metrics),
    audioUrl: s.audio_url,
    startOffsetMs: s.start_offset_ms ?? 0,
    durationMs: s.duration_ms ?? 0,
  };
}

function buildMetrics(m: BackendSnippet["metrics"]): AcousticMetric[] {
  if (!m) return [];
  const out: AcousticMetric[] = [];
  if (m.wpm != null) out.push({ label: "WPM", value: String(Math.round(m.wpm)) });
  if (m.fillers != null)
    out.push({ label: "Fillers", value: String(m.fillers) });
  if (m.pause_ms != null)
    out.push({ label: "Pause", value: `${Math.round(m.pause_ms)} ms` });
  if (m.dynamic_db != null)
    out.push({ label: "Dynamics", value: `${m.dynamic_db.toFixed(1)} dB` });
  if (m.pitch_center != null)
    // pitch_center is stored in semitones — display as "st" so users
    // know the unit. One decimal is enough granularity for a chip.
    out.push({ label: "Pitch", value: `${m.pitch_center.toFixed(1)} st` });
  if (m.energy != null)
    out.push({ label: "Energy", value: m.energy.toFixed(2) });
  return out;
}
