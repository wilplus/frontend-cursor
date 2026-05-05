import Link from "next/link";
import { Globe2, Hourglass, Play, Share2 } from "lucide-react";
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
  const isReady = status === "ready" || status === "completed";

  return (
    <div className="willab-chat min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-10">
        {isReady ? (
          <ReadyView
            sessions={MOCK_PAYLOAD.sessions}
            current={MOCK_PAYLOAD.current_session_index}
            total={MOCK_PAYLOAD.total_sessions}
          />
        ) : (
          <ProcessingView />
        )}
      </main>
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

function ProcessingView() {
  return (
    <section
      className="animate-fade-in-up flex flex-col items-center text-center"
      aria-live="polite"
    >
      {/* Pulsing badge */}
      <span className="mb-6 inline-flex animate-pulse items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        <Hourglass className="h-3 w-3" aria-hidden />
        Analysis in Progress
      </span>

      {/* Header */}
      <h1 className="text-3xl font-bold tracking-tight">
        We are analyzing your voice baseline
      </h1>

      {/* Vertical 9:16 video placeholder */}
      <div className="mt-8 aspect-[9/16] w-64 overflow-hidden rounded-2xl border border-border bg-muted shadow-sm sm:w-72">
        {/* TODO(backend): swap for a real <video> tag when the founder
            "we're analysing your voice now" clip is uploaded and exposed
            via /api/public/funnel/afterwards-video. */}
        <div className="flex h-full w-full items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <Play className="h-7 w-7 fill-current" aria-hidden />
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="mt-8 max-w-md space-y-3 text-sm text-muted-foreground">
        <p>
          Our AI and human coaches are listening to every breath, beat, and
          inflection in your recording. This usually takes a few hours — never
          longer than 24h.
        </p>
        <p>
          We&apos;ll email you the moment your Charisma Snippets are ready.
          You can safely close this tab.
        </p>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
 * STATE 2 — Journey (ready / completed)
 * ------------------------------------------------------------------------- */

function ReadyView({
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
    <>
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
    </>
  );
}
