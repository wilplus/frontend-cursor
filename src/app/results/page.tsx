"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  Globe2,
  Loader2,
  Mic,
  Play,
  Share2,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { cn } from "@/lib/utils";
import type {
  ResultsStatus,
  TimelineSession,
  VoiceJourneyTimelinePayload,
} from "@/lib/results/types";

/* ----------------------------------------------------------------------------
 * "Your Voice Journey" — user-facing Results overview.
 *
 * Distinct from /results/[sessionId] (single-session detail). Has three
 * states driven by GET /api/results/me:
 *   - empty:      no sessions yet (CTA to /chat)
 *   - processing: sessions exist but none published yet
 *   - completed:  at least one session published — render timeline
 *
 * `?status=processing|ready|completed` overrides real data so QA / preview
 * flows keep working when the backend has nothing.
 * ------------------------------------------------------------------------- */

type FetchState =
  | { kind: "loading" }
  | { kind: "ready"; data: VoiceJourneyTimelinePayload }
  | { kind: "error"; message: string };

function resolveStatusOverride(
  raw: string | null
): ResultsStatus | null {
  if (raw === "processing" || raw === "ready" || raw === "completed") {
    return raw;
  }
  return null;
}

const PREVIEW_PAYLOAD: VoiceJourneyTimelinePayload = {
  status: "completed",
  current_session_index: 1,
  total_sessions: 4,
  sessions: [
    {
      id: "preview-1",
      created_at: null,
      status: "ready",
      results_published_at: null,
      snippet_count: 3,
    },
    {
      id: "preview-2",
      created_at: null,
      status: "processing",
      results_published_at: null,
      snippet_count: 0,
    },
  ],
};

export default function VoiceJourneyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusOverride = resolveStatusOverride(searchParams.get("status"));

  const [state, setState] = useState<FetchState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/results/me", {
          cache: "no-store",
        });

        if (response.status === 401) {
          router.push("/login?redirectTo=/results");
          return;
        }

        if (!response.ok) {
          if (!cancelled) {
            setState({
              kind: "error",
              message: "We couldn't load your Voice Journey. Please try again.",
            });
          }
          return;
        }

        const data = (await response.json()) as VoiceJourneyTimelinePayload;
        if (!cancelled) {
          setState({ kind: "ready", data });
        }
      } catch (err) {
        console.error("results/me fetch failed:", err);
        if (!cancelled) {
          setState({
            kind: "error",
            message: "We couldn't load your Voice Journey. Please try again.",
          });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Decide what to render. The QA `?status=` param wins over real data so
  // every state stays previewable even when the backend has nothing.
  const view = useMemo<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "empty" }
    | { kind: "processing" }
    | { kind: "completed"; data: VoiceJourneyTimelinePayload }
  >(() => {
    if (statusOverride === "processing") return { kind: "processing" };
    if (statusOverride === "ready" || statusOverride === "completed") {
      const data =
        state.kind === "ready" && state.data.sessions.length > 0
          ? state.data
          : PREVIEW_PAYLOAD;
      return { kind: "completed", data };
    }

    if (state.kind === "loading") return { kind: "loading" };
    if (state.kind === "error") return { kind: "error", message: state.message };

    if (state.data.total_sessions === 0) return { kind: "empty" };
    if (state.data.current_session_index === 0) return { kind: "processing" };
    return { kind: "completed", data: state.data };
  }, [state, statusOverride]);

  // Viewport-locked layout: page is exactly 100dvh tall; only the active
  // inner view scrolls. The body never scrolls.
  return (
    <div className="willab-chat flex h-full flex-col overflow-hidden bg-background">
      <div className="shrink-0">
        <DashboardHeader />
      </div>
      {view.kind === "loading" && <LoadingState />}
      {view.kind === "error" && <ErrorState message={view.message} />}
      {view.kind === "empty" && <EmptyState />}
      {view.kind === "processing" && <ProcessingState />}
      {view.kind === "completed" && (
        <CompletedResultsView
          sessions={view.data.sessions}
          current={view.data.current_session_index}
          total={view.data.total_sessions}
        />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Loading / Error
 * ------------------------------------------------------------------------- */

function LoadingState() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-6 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">Loading your Voice Journey…</p>
    </main>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-6 text-center">
      <p className="text-sm text-foreground">{message}</p>
      <Button asChild variant="outline" className="rounded-full">
        <Link href="/">Return to Homepage</Link>
      </Button>
    </main>
  );
}

/* ----------------------------------------------------------------------------
 * Empty — brand-new user with zero sessions
 * ------------------------------------------------------------------------- */

function EmptyState() {
  return (
    <main className="animate-fade-in-up mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Your Voice Journey starts here.
      </h1>
      <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
        Record your first session to start your Voice Journey. Each session
        unlocks new Charisma and Stress snippets to explore with your AI coach.
      </p>
      <Button asChild className="mt-2 gap-2 rounded-full px-6">
        <Link href="/chat">
          <Mic className="h-4 w-4" aria-hidden />
          Record your first session
        </Link>
      </Button>
    </main>
  );
}

/* ----------------------------------------------------------------------------
 * Processing — has sessions, none published yet
 * ------------------------------------------------------------------------- */

function ProcessingState() {
  return (
    <main
      className="animate-fade-in-up mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6 text-center"
      aria-live="polite"
    >
      <span className="inline-flex animate-pulse items-center rounded-full border border-border px-3 py-1 text-xs">
        ⏳ Analysis in Progress
      </span>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        We are analyzing your voice baseline.
      </h1>

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

      <p className="mx-auto max-w-[280px] text-sm leading-relaxed text-muted-foreground sm:max-w-sm">
        Our AI engine and expert coaches are currently extracting your
        Charisma and Stress snippets. This process usually takes a little
        while. You can safely close this page—we will email you the moment
        your customized insights are ready.
      </p>

      <Button asChild variant="outline" className="mt-4 rounded-full">
        <Link href="/">Return to Homepage</Link>
      </Button>
    </main>
  );
}

/* ----------------------------------------------------------------------------
 * Completed — Voice Journey timeline
 * ------------------------------------------------------------------------- */

function CompletedResultsView({
  sessions,
  current,
  total,
}: {
  sessions: TimelineSession[];
  current: number;
  total: number;
}) {
  const completed = Math.min(current, total);
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-10">
      <header className="mb-8 animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">Your Voice Journey</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Each session adds a new chapter. Tap any ready session to dive into
          your snippets.
        </p>
      </header>

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
          {completed} of {total} {total === 1 ? "session" : "sessions"} ready
        </p>
      </section>

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

      <ol className="space-y-4">
        {sessions.map((session, idx) => (
          <li
            key={session.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${220 + idx * 80}ms` }}
          >
            <SessionTimelineCard session={session} index={idx} />
          </li>
        ))}
      </ol>

      <p className="mt-12 text-center text-xs text-muted-foreground">
        More sessions unlock as you keep recording.
      </p>
    </main>
  );
}

function SessionTimelineCard({
  session,
  index,
}: {
  session: TimelineSession;
  index: number;
}) {
  const isReady = session.status === "ready";
  const dateLabel = formatSessionDate(
    session.results_published_at ?? session.created_at
  );

  const cardBase =
    "group block w-full rounded-2xl border bg-card p-5 text-left shadow-sm transition-all";
  const cardClass = isReady
    ? `${cardBase} hover:border-primary/40 hover:shadow-md`
    : `${cardBase} opacity-90`;

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Session {index + 1}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            {dateLabel ?? "Recorded session"}
          </h2>
        </div>
        <Badge variant={isReady ? "success" : "outline"}>
          {isReady ? "Ready" : "Processing"}
        </Badge>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {isReady
          ? `${session.snippet_count} ${session.snippet_count === 1 ? "snippet" : "snippets"} ready to explore`
          : "Our coaches are analyzing your recording. We'll email you when it's ready."}
      </p>

      {isReady && (
        <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
          View results
          <ChevronRight
            aria-hidden
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          />
        </div>
      )}
    </>
  );

  if (isReady) {
    return (
      <Link
        href={`/results/${encodeURIComponent(session.id)}`}
        className={cn(cardClass, "border-border")}
      >
        {inner}
      </Link>
    );
  }

  return <div className={cn(cardClass, "border-dashed border-border")}>{inner}</div>;
}

function formatSessionDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
