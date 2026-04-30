"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCcw, Sparkles } from "lucide-react";
import SectionCard from "@/components/admin/SectionCard";
import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 90_000;
const STATUS_LABELS = [
  "Analyzing stress patterns…",
  "Mapping charisma markers…",
  "Finalizing report…",
];

interface SessionDetail {
  id?: string;
  ai_suggested_profile?: string | null;
  ai_suggested_task?: string | null;
  suggested_task?: string | null;
}

type PollStatus = "loading" | "ready" | "timeout" | "error";

export default function SessionRevealClient({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<PollStatus>("loading");
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [labelIndex, setLabelIndex] = useState(0);
  const startedAtRef = useRef<number>(Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const labelRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (labelRef.current) {
      clearInterval(labelRef.current);
      labelRef.current = null;
    }
  }, []);

  const fetchOnce = useCallback(async () => {
    try {
      const resp = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        credentials: "include",
      });
      if (!resp.ok) {
        if (resp.status === 401) {
          setStatus("error");
          stopPolling();
        }
        return;
      }
      const data = (await resp.json()) as SessionDetail;
      if (data && data.ai_suggested_profile) {
        setDetail(data);
        setStatus("ready");
        stopPolling();
      }
    } catch {
      // Transient network errors during polling are non-fatal; the timeout will catch a stuck state.
    }
  }, [sessionId, stopPolling]);

  const startPolling = useCallback(() => {
    startedAtRef.current = Date.now();
    setStatus("loading");
    setLabelIndex(0);
    void fetchOnce();
    pollRef.current = setInterval(() => {
      if (Date.now() - startedAtRef.current >= POLL_TIMEOUT_MS) {
        setStatus("timeout");
        stopPolling();
        return;
      }
      void fetchOnce();
    }, POLL_INTERVAL_MS);
    labelRef.current = setInterval(() => {
      setLabelIndex((i) => (i + 1) % STATUS_LABELS.length);
    }, 2_500);
  }, [fetchOnce, stopPolling]);

  useEffect(() => {
    startPolling();
    return () => {
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  if (status === "ready" && detail?.ai_suggested_profile) {
    const suggestedTask = detail.ai_suggested_task ?? detail.suggested_task ?? null;
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div className="text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold">Your Behavioral Profile</h1>
          <p className="mt-2 text-muted-foreground">
            Based on your 15-second voice clip.
          </p>
        </div>

        <SectionCard title="Profile">
          <p className="text-base">{detail.ai_suggested_profile}</p>
        </SectionCard>

        {suggestedTask && (
          <SectionCard
            title="Suggested practice"
            description="Start here to build on what your voice already does well."
          >
            <p className="text-base">{suggestedTask}</p>
          </SectionCard>
        )}
      </div>
    );
  }

  if (status === "timeout") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <SectionCard
          title="Still working on it"
          description="Our analysis pipeline is taking longer than usual. Refresh in a minute."
        >
          <Button
            type="button"
            onClick={() => startPolling()}
            className="gap-2 bg-orange-500 hover:bg-orange-600"
          >
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
        </SectionCard>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <SectionCard title="We couldn't load your session">
          <p className="text-sm text-muted-foreground">
            Try refreshing the page. If the problem persists, please sign in again.
          </p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-12 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-orange-500" aria-hidden />
      <h2 className="mt-6 text-2xl font-semibold">Building your profile…</h2>
      <p
        className="mt-3 min-h-[1.5rem] text-sm text-muted-foreground transition-opacity"
        aria-live="polite"
      >
        {STATUS_LABELS[labelIndex]}
      </p>
      <p className="mt-6 max-w-sm text-xs text-muted-foreground">
        Typically takes 10–30 seconds. We'll show your real result the moment it's ready.
      </p>
    </div>
  );
}
