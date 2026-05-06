import Link from "next/link";
import { Globe2, Play, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import JourneySnippetCard from "@/components/results/journey/JourneySnippetCard";
import type {
  JourneySession,
  ResultsStatus,
  VoiceJourneyPayload,
} from "@/lib/results/types";

/* ----------------------------------------------------------------------------
 * "Your Voice Journey" — user-facing Results overview.
 *
 * Distinct from /results/[sessionId] (single-session detail). Has two states:
 *   - "processing": baseline analysis still running (founder video + waiting copy)
 *   - "ready" / "completed": the chronological snippet timeline
 *
 * State source:
 *   1. URL param `?status=processing|ready|completed` (lets the user/QA bounce
 *      between states without needing the backend to be live).
 *   2. Otherwise falls back to MOCK_PAYLOAD.status below.
 *
 * TODO(backend): replace MOCK_PAYLOAD with `await getMyVoiceJourney()` once a
 * GET /api/results/me endpoint exists returning a VoiceJourneyPayload.
 * ------------------------------------------------------------------------- */

const MOCK_PAYLOAD: VoiceJourneyPayload = {
  status: "ready",
  current_session_index: 1,
  total_sessions: 4,
  sessions: [
    {
      id: "s-1",
      title: "Session 1: Baseline Audio",
      snippets: [
        {
          id: "snip-1a",
          type: "charisma",
          duration: "0:12",
          badgeLabel: "Charisma Moment",
          insight:
            "Right here your tone opened up — pace slowed by 15% and pitch rose. " +
            "That's the warmth that pulls listeners in. Notice how natural it felt.",
          ctaLabel: "Understand your charisma",
          metrics: [
            { label: "WPM", value: "138" },
            { label: "Pitch", value: "Rising" },
            { label: "Pause", value: "0.6s" },
            { label: "Energy", value: "78%" },
          ],
        },
        {
          id: "snip-1b",
          type: "stress",
          duration: "0:09",
          badgeLabel: "Stress Pattern",
          insight:
            "Pace jumped to 195 WPM and pitch flattened — classic rushing under " +
            "pressure. Try a one-breath pause before the next answer.",
          ctaLabel: "Work on this stress",
          metrics: [
            { label: "WPM", value: "195" },
            { label: "Pitch", value: "Flat" },
            { label: "Fillers", value: "4" },
            { label: "Energy", value: "62%" },
          ],
        },
        {
          id: "snip-1c",
          type: "charisma",
          duration: "0:18",
          badgeLabel: "Charisma Moment",
          insight:
            "Excellent dynamic range here — you used silence as punctuation. " +
            "Audiences read confidence in those held beats.",
          ctaLabel: "Understand your charisma",
          metrics: [
            { label: "WPM", value: "142" },
            { label: "Pitch", value: "Varied" },
            { label: "Pause", value: "1.2s" },
            { label: "Dynamic dB", value: "13" },
          ],
        },
      ],
    },
  ],
};

function resolveStatus(
  raw: string | string[] | undefined,
  fallback: ResultsStatus
): ResultsStatus {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "processing" || value === "ready" || value === "completed") {
    return value;
  }
  return fallback;
}

interface PageProps {
  searchParams?: { status?: string | string[] };
}

export default function VoiceJourneyPage({ searchParams }: PageProps) {
  const status = resolveStatus(searchParams?.status, MOCK_PAYLOAD.status);

  // Navbar stays mounted for both states so the user feels grounded in the
  // app no matter which view is rendered. Inner views own their own widths.
  return (
    <div className="willab-chat min-h-screen bg-background">
      <Navbar />
      {status === "processing" ? (
        <ProcessingState />
      ) : (
        <CompletedResultsView
          sessions={MOCK_PAYLOAD.sessions}
          current={MOCK_PAYLOAD.current_session_index}
          total={MOCK_PAYLOAD.total_sessions}
        />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Navbar — dark band with italic "Willab." wordmark (orange period)
 * ------------------------------------------------------------------------- */

function Navbar() {
  return (
    <header className="bg-foreground text-primary-foreground">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <Link href="/" aria-label="Willab home" className="inline-flex items-baseline">
          <span className="text-lg font-bold italic tracking-tight">Willab</span>
          <span className="text-lg font-bold italic text-primary">.</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/results" className="opacity-90 hover:opacity-100">
            Results
          </Link>
        </nav>
      </div>
    </header>
  );
}

/* ----------------------------------------------------------------------------
 * STATE 1 — Processing
 * ------------------------------------------------------------------------- */

function ProcessingState() {
  return (
    <main
      className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center gap-6 p-6 text-center animate-fade-in-up"
      aria-live="polite"
    >
      {/* Pulsing status badge — neutral border per spec */}
      <span className="inline-flex animate-pulse items-center rounded-full border border-border px-3 py-1 text-xs">
        ⏳ Analysis in Progress
      </span>

      {/* Header */}
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        We are analyzing your voice baseline.
      </h1>

      {/* Vertical 9:16 video placeholder with caption */}
      <div className="relative mx-auto flex aspect-[9/16] w-64 flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-border bg-muted sm:w-72">
        {/* TODO(backend): swap for a real <video> tag when the founder
            "we're analysing your voice now" clip is uploaded and exposed
            via /api/public/funnel/afterwards-video. */}
        <button
          type="button"
          aria-label="Play founder message"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
        >
          <Play className="h-6 w-6 fill-current" aria-hidden />
        </button>
        <p className="text-sm font-medium text-muted-foreground">
          Founder Message
        </p>
      </div>

      {/* Description */}
      <p className="mx-auto max-w-[280px] text-sm leading-relaxed text-muted-foreground sm:max-w-sm">
        Our AI engine and expert coaches are currently extracting your
        Charisma and Stress snippets. This process usually takes a little
        while. You can safely close this page—we will email you the moment
        your customized insights are ready.
      </p>

      {/* Return action */}
      <Button asChild variant="outline" className="mt-4 rounded-full">
        <Link href="/">Return to Homepage</Link>
      </Button>
    </main>
  );
}

/* ----------------------------------------------------------------------------
 * STATE 2 — Completed Results (a.k.a. "ready") — Voice Journey timeline
 * ------------------------------------------------------------------------- */

function CompletedResultsView({
  sessions,
  current,
  total,
}: {
  sessions: JourneySession[];
  current: number;
  total: number;
}) {
  const completed = Math.min(current, total);
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/* Page heading */}
      <header className="mb-8 animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">Your Voice Journey</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Each session adds a new chapter. Tap any snippet to explore it
          with your AI coach.
        </p>
      </header>

      {/* Progress tracker */}
      <section
        className="mb-8 animate-fade-in-up"
        style={{ animationDelay: "60ms" }}
        aria-label="Session progress"
      >
        <div className="h-[1.5px] w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
            role="progressbar"
            aria-valuenow={completed}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label={`Session ${completed} of ${total} complete`}
          />
        </div>
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          Session {completed} of {total}: The Baseline Completed
        </p>
      </section>

      {/* Share & Community CTA */}
      <section
        className="mb-10 animate-fade-in-up rounded-2xl border border-border bg-card p-4 shadow-sm"
        style={{ animationDelay: "140ms" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Spread the journey or see what others discovered.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Share2 className="h-3.5 w-3.5" aria-hidden />
              Share Results
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Globe2 className="h-3.5 w-3.5" aria-hidden />
              See Community Snippets
            </button>
          </div>
        </div>
      </section>

      {/* Sessions list */}
      <div className="space-y-12">
        {sessions.map((session, sessionIdx) => (
          <section
            key={session.id}
            aria-label={session.title}
            className="animate-fade-in-up"
            style={{ animationDelay: `${220 + sessionIdx * 80}ms` }}
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold tracking-tight">
                {session.title}
              </h2>
              <div className="mt-3 h-px w-full bg-border" />
            </div>
            <div className="space-y-4">
              {session.snippets.map((snip, snipIdx) => (
                <JourneySnippetCard
                  key={snip.id}
                  snippet={snip}
                  index={snipIdx}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Empty-tail nudge */}
      <p className="mt-12 text-center text-xs text-muted-foreground">
        More sessions unlock as you keep recording.
      </p>
    </main>
  );
}
