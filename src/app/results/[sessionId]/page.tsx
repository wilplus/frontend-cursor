"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import SnippetCard from "@/components/results/SnippetCard";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

interface Snippet {
  id: string;
  session_id: string;
  user_id: string;
  recording_id: string;
  start_offset_ms: number;
  duration_ms: number;
  audio_segment_path: string;
  snippet_type: string;
  admin_comment: string | null;
  admin_user_id: string | null;
  created_at: string;
  updated_at: string;
}

type ResultsStatus = "processing" | "completed" | "unknown";

function ProcessingState({ onReturnHome }: { onReturnHome: () => void }) {
  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-col items-center justify-center min-h-[80vh] max-w-md mx-auto text-center gap-6 p-6">
        <div className="rounded-full border border-border px-3 py-1 text-xs animate-pulse">
          ⏳ Analysis in Progress
        </div>

        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          We are analyzing your voice baseline.
        </h1>

        <div className="aspect-[9/16] w-64 sm:w-72 rounded-2xl border border-border bg-muted overflow-hidden relative flex flex-col items-center justify-center gap-4 mx-auto">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground transition-transform hover:scale-105">
            <Play className="h-6 w-6" />
          </div>
          <div className="text-sm font-medium text-muted-foreground">Founder Message</div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] sm:max-w-sm mx-auto">
          Our AI engine and expert coaches are currently extracting your Charisma and Stress
          snippets. This process usually takes a little while. You can safely close this page—we
          will email you the moment your customized insights are ready.
        </p>

        <Button variant="outline" className="rounded-full mt-4" onClick={onReturnHome}>
          Return to Homepage
        </Button>
      </div>
    </div>
  );
}

function CompletedResultsView({
  sessionId,
}: {
  sessionId: string;
}) {
  const router = useRouter();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
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

        const data = await response.json();
        setSnippets(data.snippets || []);
      } catch (err) {
        console.error("Error fetching snippets:", err);
        setError("An error occurred while loading your snippets.");
      } finally {
        setLoading(false);
      }
    };

    void fetchSnippets();
  }, [sessionId, router]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Your Charisma Moments</h1>
        <p className="text-muted-foreground">
          Here are the moments where you showed great communication.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Loading your snippets...</p>
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

      {!loading && !error && snippets.length === 0 && (
        <div className="space-y-4 rounded-lg border border-dashed border-border bg-muted/50 p-8 text-center">
          <p className="text-muted-foreground">No snippets have been added to your results yet.</p>
          <p className="text-sm text-muted-foreground">
            Your coach will analyze your recording and add personalized feedback soon.
          </p>
        </div>
      )}

      {!loading && !error && snippets.length > 0 && (
        <div className="space-y-6">
          {snippets.map((snippet) => (
            <SnippetCard key={snippet.id} snippet={snippet} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [status, setStatus] = useState<ResultsStatus>("unknown");
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

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
        const next =
          data?.status === "completed"
            ? ("completed" as const)
            : data?.status === "processing"
              ? ("processing" as const)
              : ("processing" as const);
        if (!cancelled) setStatus(next);
      } catch (err) {
        console.error("Error fetching results status:", err);
        if (!cancelled) setStatusError("An error occurred while loading your session status.");
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    };

    void fetchStatus();

    intervalId = window.setInterval(() => {
      if (cancelled) return;
      if (status === "processing" || status === "unknown") void fetchStatus();
    }, 5000);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [sessionId, router]);

  return (
    <main className="min-h-screen bg-background">
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
        <ProcessingState onReturnHome={() => router.push("/")} />
      )}

      {!statusLoading && !statusError && status === "completed" && (
        <CompletedResultsView sessionId={sessionId} />
      )}
    </main>
  );
}
