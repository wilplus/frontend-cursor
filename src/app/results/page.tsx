import Link from "next/link";
import { Globe2, Share2 } from "lucide-react";
import JourneySnippetCard, {
  type JourneySnippet,
} from "@/components/results/journey/JourneySnippetCard";

/* ----------------------------------------------------------------------------
 * "Your Voice Journey" — user-facing Results overview.
 *
 * Distinct from /results/[sessionId] (single-session detail). This page is
 * the chronological multi-session timeline with the progress tracker, the
 * Share / Community CTA, and the Infinite Retention Loop snippet cards.
 *
 * Mock data per spec — wire to real backend once a /api/results/me endpoint
 * exists that returns the full session list with snippet bundles.
 * ------------------------------------------------------------------------- */

interface JourneySession {
  id: string;
  title: string;
  snippets: JourneySnippet[];
}

const TOTAL_SESSIONS = 4;
const CURRENT_SESSION = 1;

const MOCK_SESSIONS: JourneySession[] = [
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
];

export default function VoiceJourneyPage() {
  const completed = Math.min(CURRENT_SESSION, TOTAL_SESSIONS);
  const progressPct = Math.round((completed / TOTAL_SESSIONS) * 100);

  return (
    <div className="willab-chat min-h-screen bg-background">
      {/* Dark navbar — mirrors the chat UI */}
      <header className="bg-foreground text-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-lg font-bold italic tracking-tight"
            aria-label="Willab home"
          >
            willab
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/results" className="opacity-90 hover:opacity-100">
              Results
            </Link>
          </nav>
        </div>
      </header>

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
              aria-valuemax={TOTAL_SESSIONS}
              aria-label={`Session ${completed} of ${TOTAL_SESSIONS} complete`}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            Session {completed} of {TOTAL_SESSIONS}: The Baseline Completed
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
          {MOCK_SESSIONS.map((session, sessionIdx) => (
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
    </div>
  );
}
