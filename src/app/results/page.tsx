"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ProcessingState from "@/components/results/ProcessingState";
import MirrorPanel from "@/components/results/MirrorPanel";
import JourneySnippetCard from "@/components/results/journey/JourneySnippetCard";
import type {
  JourneySession,
  Snippet,
  VoiceJourneyPayload,
} from "@/lib/results/types";

/**
 * /results — the Willab Voice Journey Timeline.
 *
 * Renders ALL of the user's published sessions as a chronological stack
 * of "session group → snippet cards". Sessions come from the backend
 * (`GET /api/results/me`), which proxies to `/v2/user/results/me`.
 *
 * Filter rule (per product): a snippet only renders if BOTH
 *   • `insight` is non-empty (the coach actually wrote a comment), AND
 *   • `audioUrl` is set (the clip is playable).
 * Anything else is dropped silently — the user never sees an empty
 * "feedback pending" placeholder. Sessions that have zero playable +
 * commented snippets after filtering are skipped entirely.
 *
 * If the user has zero published sessions (or every session is filtered
 * to empty), we fall back to <ProcessingState/> — same waiting screen
 * the user sees while the admin is still working.
 */

type PageState =
  | { kind: "loading" }
  | { kind: "processing" }
  | { kind: "ready"; sessions: JourneySession[] }
  | { kind: "error"; message: string };

export default function VoiceJourneyPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    const fetchTimeline = async () => {
      try {
        const res = await fetch("/api/results/me", { cache: "no-store" });

        if (res.status === 401) {
          if (!cancelled) router.replace("/login?redirectTo=/results");
          return;
        }

        if (!res.ok) {
          if (!cancelled) {
            setState({
              kind: "error",
              message:
                "We couldn't load your Voice Journey. Please refresh in a moment.",
            });
          }
          return;
        }

        const data = (await res.json()) as VoiceJourneyPayload;
        if (cancelled) return;

        const sessions = filterTimeline(data.sessions ?? []);
        if (sessions.length === 0) {
          // Nothing publishable yet (either backend status === processing,
          // or every snippet was filtered out for being empty / silent).
          setState({ kind: "processing" });
          return;
        }
        setState({ kind: "ready", sessions });
      } catch (err) {
        console.error("Failed to load /api/results/me:", err);
        if (!cancelled) {
          setState({
            kind: "error",
            message:
              "We couldn't reach the server. Check your connection and try again.",
          });
        }
      }
    };

    void fetchTimeline();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="willab-chat flex min-h-full flex-col bg-background">
      <DashboardHeader />
      {state.kind === "loading" && <LoadingShell />}
      {state.kind === "error" && <ErrorShell message={state.message} />}
      {state.kind === "processing" && <ProcessingState />}
      {state.kind === "ready" && <Timeline sessions={state.sessions} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Timeline                                                                  */
/* -------------------------------------------------------------------------- */

function Timeline({ sessions }: { sessions: JourneySession[] }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      {/* Page header */}
      <header className="mb-8 space-y-2">
        <h1 className="font-heading text-3xl text-foreground sm:text-4xl">
          Your Voice Journey
        </h1>
        <p className="text-sm text-muted-foreground">
          Moments your coach pulled out of your sessions, with a path back into
          the conversation.
        </p>
      </header>

      {/* User-scoped coaching mirror — sits between the header and the
          sessions stack; renders nothing when the feature flag is off
          or the user has no published mirror yet. */}
      <MirrorPanel />

      {/* Sessions stack */}
      <div className="space-y-10">
        {sessions.map((session) => (
          <SessionGroup key={session.id} session={session} />
        ))}
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*  Session group                                                             */
/* -------------------------------------------------------------------------- */

function SessionGroup({ session }: { session: JourneySession }) {
  return (
    <section className="mb-10 last:mb-0">
      {/* Session header — title + hairline that fills the rest of the row */}
      <div className="mb-5 flex items-center gap-4">
        <h2 className="shrink-0 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {session.title}
        </h2>
        <div className="h-px flex-1 border-t border-border" />
      </div>

      <div className="space-y-5">
        {session.snippets.map((snippet, i) => (
          <JourneySnippetCard key={snippet.id} snippet={snippet} index={i} />
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Filter — drop snippets without a coach comment OR without playable audio  */
/* -------------------------------------------------------------------------- */

function filterTimeline(sessions: JourneySession[]): JourneySession[] {
  return sessions
    .map((session) => ({
      ...session,
      snippets: session.snippets.filter(isPublishable),
    }))
    .filter((session) => session.snippets.length > 0);
}

/** Snippets only render when both criteria are met — no half-baked cards. */
function isPublishable(s: Snippet): boolean {
  return Boolean(s.audioUrl && s.insight && s.insight.trim().length > 0);
}

/* -------------------------------------------------------------------------- */
/*  Loading / error shells                                                    */
/* -------------------------------------------------------------------------- */

function LoadingShell() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2
        className="h-6 w-6 animate-spin text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}

function ErrorShell({ message }: { message: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button
        type="button"
        variant="outline"
        onClick={() => window.location.reload()}
        className="rounded-full"
      >
        Try again
      </Button>
    </main>
  );
}
