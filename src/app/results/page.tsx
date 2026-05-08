"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

/**
 * "Your Voice Journey" — user-facing Results overview.
 *
 * This page is now a pure router/processing-shell. There is NO mock data.
 * On mount it asks /api/results/state for the user's session situation
 * and either redirects (no_session → /chat, completed → /results/[id])
 * or shows the "we're analyzing your baseline" waiting UI for users
 * whose session exists but hasn't been published by the admin yet.
 *
 * While in the processing state we gently poll every POLL_INTERVAL_MS so
 * the page auto-flips to /results/[id] the moment the admin publishes,
 * without the user having to refresh.
 */

type StateResponse =
  | { kind: "no_session" }
  | { kind: "processing"; session_id: string }
  | { kind: "completed"; session_id: string };

type PageState =
  | { kind: "loading" }
  | { kind: "processing"; session_id: string }
  | { kind: "error"; message: string };

const POLL_INTERVAL_MS = 10_000;

export default function VoiceJourneyPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const fetchState = async (): Promise<StateResponse | null> => {
      try {
        const res = await fetch("/api/results/state", { cache: "no-store" });
        if (res.status === 401) {
          if (!cancelledRef.current) {
            router.replace("/login?redirectTo=/results");
          }
          return null;
        }
        if (!res.ok) {
          if (!cancelledRef.current) {
            setState({
              kind: "error",
              message:
                "We couldn't load your Voice Journey. Please refresh in a moment.",
            });
          }
          return null;
        }
        return (await res.json()) as StateResponse;
      } catch {
        if (!cancelledRef.current) {
          setState({
            kind: "error",
            message:
              "We couldn't reach the server. Check your connection and try again.",
          });
        }
        return null;
      }
    };

    const handleResponse = (data: StateResponse) => {
      if (cancelledRef.current) return;
      switch (data.kind) {
        case "no_session":
          // No recordings yet — send them to the chat to record their baseline.
          router.replace("/chat");
          return;
        case "completed":
          // Latest session is published — jump straight to the snippets view.
          router.replace(`/results/${encodeURIComponent(data.session_id)}`);
          return;
        case "processing":
          setState({ kind: "processing", session_id: data.session_id });
          return;
      }
    };

    // First fetch on mount.
    void (async () => {
      const data = await fetchState();
      if (data) handleResponse(data);
    })();

    // While we're in the processing state, poll quietly so the page auto-
    // flips to /results/[id] the moment the admin publishes. The interval
    // is set up once and tears itself down when the state changes (the
    // outer useEffect re-runs only on cancellation).
    const pollId = window.setInterval(() => {
      void (async () => {
        // Cheap guard: only poll while we believe we're processing.
        // Any other state (loading / error) means the first fetch hasn't
        // resolved or has surfaced an error; either way, don't pile on.
        const data = await fetchState();
        if (data) handleResponse(data);
      })();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelledRef.current = true;
      window.clearInterval(pollId);
    };
  }, [router]);

  return (
    <div className="willab-chat flex h-full flex-col overflow-hidden bg-background">
      <div className="shrink-0">
        <DashboardHeader />
      </div>
      {state.kind === "loading" && <LoadingShell />}
      {state.kind === "error" && <ErrorShell message={state.message} />}
      {state.kind === "processing" && <ProcessingState />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function LoadingShell() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
    </div>
  );
}

function ErrorShell({ message }: { message: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
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

/**
 * Processing state — the user has a recorded session but the admin hasn't
 * published the snippets yet. We show the founder video placeholder and
 * a calm waiting message so the user knows the app is working.
 */
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

      {/* TODO(backend): swap for a real <video> tag when the founder
          "we're analysing your voice now" clip is uploaded and exposed
          via /api/public/funnel/afterwards-video. */}
      <div className="relative mx-auto flex aspect-[9/16] w-64 flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-border bg-muted sm:w-72">
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
        Our AI engine and expert coaches are currently analyzing your vocal
        patterns. This usually takes a little while. You can safely close
        this page — we will email you the moment your customized insights
        are ready.
      </p>

      <Button asChild variant="outline" className="mt-4 rounded-full">
        <Link href="/">Return to Homepage</Link>
      </Button>
    </main>
  );
}
