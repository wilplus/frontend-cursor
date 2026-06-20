"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Mic,
  Send,
  Sparkles,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

/* ----------------------------------------------------------------------------
 * /coach/[coachingId]
 *
 * The actual micro-coaching loop. State machine:
 *
 *   awareness:
 *     Bot's first bubble = the admin's comment (served verbatim by the
 *     backend; no LLM call). User types a one-line honest reaction. We
 *     POST /api/coaching/turn — backend's awareness prompt returns one
 *     reframe + one scenario setup, and emits [ADVANCE] so we flip into:
 *
 *   trial:
 *     Text input is hidden. ONE big record button. User re-performs the
 *     moment (stress OR charisma — backend picks the prompt by `intent`)
 *     with the new mindset. POST /api/coaching/trial-recording.
 *     Backend creates a v2_session and runs the snippet pipeline. We flip to:
 *
 *   complete:
 *     "✨ New snippets generated" success card linking back to /results,
 *     where the new evidence will surface as the timeline updates.
 *
 * Reload-safe: the /api/coaching/[id] GET re-hydrates current_stage, so a
 * mid-loop refresh lands on the right UI rather than starting over.
 * ------------------------------------------------------------------------- */

interface SourceSnippet {
  id: string;
  transcript?: string | null;
  audio_url?: string | null;
  duration_ms?: number | null;
}

interface CoachingHydrated {
  coaching_id: string;
  intent: "stress" | "charisma";
  current_stage: "awareness" | "trial" | "complete";
  awareness_message: string;
  source_snippet: SourceSnippet;
  trial_session_id?: string | null;
}

interface ChatMessage {
  id: string;
  role: "bot" | "user";
  content: string;
}

interface PageProps {
  params: { coachingId: string };
}

export default function CoachingPage({ params }: PageProps) {
  const router = useRouter();
  const coachingId = params.coachingId;

  const [hydrating, setHydrating] = useState(true);
  const [stage, setStage] = useState<"awareness" | "trial" | "complete">(
    "awareness"
  );
  // intent drives copy throughout: the awareness placeholder and the
  // trial-stage instructions read very differently for stress
  // (reframe → re-perform same scenario) vs charisma (anchor → strip
  // the trigger → re-perform a harder scenario).
  const [intent, setIntent] = useState<"stress" | "charisma">("stress");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [snippet, setSnippet] = useState<SourceSnippet | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // Recording state — only meaningful in the trial stage.
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Hydrate ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/coaching/${encodeURIComponent(coachingId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          if (res.status === 401) {
            router.replace(
              `/login?redirectTo=${encodeURIComponent(`/coach/${coachingId}`)}`
            );
            return;
          }
          toast.error("Coaching session not found.");
          router.replace("/chat");
          return;
        }
        const data = (await res.json()) as CoachingHydrated;
        if (cancelled) return;
        setSnippet(data.source_snippet);
        setStage(data.current_stage);
        setIntent(data.intent);
        // Always seed the awareness bubble so users who land in trial
        // mode mid-flow still see the original context above the
        // record control.
        setMessages([
          {
            id: "awareness-0",
            role: "bot",
            content: data.awareness_message,
          },
        ]);
      } catch (err) {
        console.error("coach/[id] hydrate failed:", err);
        if (!cancelled) {
          toast.error("Couldn't load this coaching session.");
          router.replace("/chat");
        }
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coachingId, router]);

  // Autoscroll chat to bottom when messages change.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, stage]);

  // ── Awareness — send a typed message ─────────────────────────────────
  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending || stage !== "awareness") return;

    setSending(true);
    setMessages((m) => [
      ...m,
      { id: `u-${Date.now()}`, role: "user", content: text },
    ]);
    setDraft("");

    try {
      const res = await fetch("/api/coaching/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coaching_id: coachingId,
          user_message: text,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        bubbles?: [string, string];
        advance?: boolean;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Coach is unavailable.");
        return;
      }
      const [b1, b2] = data.bubbles ?? ["", ""];
      const next: ChatMessage[] = [];
      if (b1)
        next.push({ id: `b-${Date.now()}-0`, role: "bot", content: b1 });
      if (b2)
        next.push({ id: `b-${Date.now()}-1`, role: "bot", content: b2 });
      setMessages((m) => [...m, ...next]);
      if (data.advance) setStage("trial");
    } catch (err) {
      console.error("coaching/turn failed:", err);
      toast.error("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // ── Trial — start/stop recording ─────────────────────────────────────
  const startRecording = async () => {
    if (recording || uploading || stage !== "trial") return;
    // No getUserMedia on this device (the iOS < 14.3 standalone-PWA case):
    // on iOS point the user to Safari (where the mic works) instead of a
    // confusing failure; elsewhere it's an unsupported browser.
    if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
      toast.error(
        /iPhone|iPad|iPod/.test(navigator.userAgent)
          ? "Recording needs Safari on this device — open this page in Safari to record."
          : "Voice recording isn't supported in this browser.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        // Tear down the mic stream — the browser keeps it hot otherwise.
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        await uploadTrial(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      // Hard cap at 60s — same budget as the cold-start funnel upload.
      recordTimeoutRef.current = setTimeout(() => stopRecording(), 60_000);
    } catch (err) {
      console.error("startRecording failed:", err);
      const name = err instanceof Error ? err.name : "";
      toast.error(
        /NotAllowed|Permission/i.test(name)
          ? "Microphone blocked — enable mic access in Settings, then try again."
          : "Couldn't access the microphone.",
      );
    }
  };

  const stopRecording = () => {
    if (recordTimeoutRef.current) {
      clearTimeout(recordTimeoutRef.current);
      recordTimeoutRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setRecording(false);
  };

  const uploadTrial = async (audioBlob: Blob) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("coaching_id", coachingId);
      fd.append("audio_file", audioBlob, "trial.webm");
      const res = await fetch("/api/coaching/trial-recording", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: string;
        trial_session_id?: string;
        error?: string;
      };
      if (!res.ok || data.status !== "ok") {
        toast.error(data.error ?? "Couldn't process your recording.");
        return;
      }
      setStage("complete");
      toast.success("Trial recorded — generating new snippets…");
    } catch (err) {
      console.error("trial upload failed:", err);
      toast.error("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────
  if (hydrating) {
    return (
      <div className="willab-chat flex h-full flex-col bg-background">
        <DashboardHeader />
        <div className="flex flex-1 items-center justify-center">
          <Loader2
            className="h-6 w-6 animate-spin text-muted-foreground"
            aria-hidden
          />
        </div>
      </div>
    );
  }

  return (
    <div className="willab-chat flex h-full flex-col bg-background">
      <DashboardHeader />

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
        {/* Back to /chat — explicit so the user knows they can leave */}
        <Link
          href="/chat"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to your snippets
        </Link>

        {/* Source snippet preview */}
        {snippet?.audio_url ? (
          <div className="mb-6 rounded-2xl border border-border bg-muted/30 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {intent === "charisma"
                ? "The magnetic moment"
                : "The moment we're working on"}
            </p>
            <audio
              controls
              src={snippet.audio_url}
              controlsList="nodownload"
              className="w-full"
            />
          </div>
        ) : null}

        {/* Chat transcript */}
        <div
          ref={scrollRef}
          className="mb-4 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card p-4"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Coach is thinking…
              </div>
            </div>
          )}
        </div>

        {/* Input area — three modes: awareness / trial / complete */}
        {stage === "awareness" && (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                intent === "charisma"
                  ? "What triggered that confidence? Be specific."
                  : "Be honest — what was actually going through your head?"
              }
              rows={2}
              disabled={sending}
              className="flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-sm focus:border-primary focus:outline-none disabled:opacity-60"
            />
            <Button
              type="submit"
              disabled={!draft.trim() || sending}
              className="h-12 rounded-2xl px-5"
            >
              <Send className="h-4 w-4" aria-hidden />
            </Button>
          </form>
        )}

        {stage === "trial" && (
          <TrialRecorder
            intent={intent}
            recording={recording}
            uploading={uploading}
            onStart={startRecording}
            onStop={stopRecording}
          />
        )}

        {stage === "complete" && <CompleteCard />}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Trial recorder — the input is locked to mic-only at this stage. By
 * design there is NO text fallback: the methodology requires the user to
 * actually re-perform with their voice, otherwise nothing useful gets
 * generated for the next loop.
 * ------------------------------------------------------------------------- */

function TrialRecorder({
  intent,
  recording,
  uploading,
  onStart,
  onStop,
}: {
  intent: "stress" | "charisma";
  recording: boolean;
  uploading: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const busy = uploading;

  // Stress: re-perform the SAME scenario with the new emotional frame.
  // Charisma: re-perform a HARDER scenario holding the SAME magnetic
  // tone the user had originally. Two genuinely different briefs, two
  // genuinely different bodies of copy.
  const trialCopy =
    intent === "charisma"
      ? "Hold the same magnetic tone. The scenario is harder, the anchor is gone. You can take up to 60 seconds."
      : "Deliver your line. One shot. The new mindset. You can take up to 60 seconds.";

  return (
    <div className="rounded-3xl border border-border bg-muted/40 p-6 text-center">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Trial — mic on
      </p>
      <p className="mb-5 text-sm leading-relaxed text-foreground">
        {trialCopy}
      </p>

      <button
        type="button"
        onClick={recording ? onStop : onStart}
        disabled={busy}
        className={cn(
          "inline-flex h-20 w-20 items-center justify-center rounded-full text-primary-foreground shadow-lg transition-transform disabled:opacity-60",
          recording
            ? "animate-pulse bg-destructive hover:scale-105"
            : "bg-primary hover:scale-105"
        )}
        aria-label={recording ? "Stop recording" : "Start recording"}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        ) : recording ? (
          <Square className="h-7 w-7 fill-current" aria-hidden />
        ) : (
          <Mic className="h-8 w-8" aria-hidden />
        )}
      </button>

      <p className="mt-4 text-xs text-muted-foreground">
        {uploading
          ? "Uploading and analyzing…"
          : recording
            ? "Recording — tap to stop."
            : "Tap to start."}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Complete card — the loop closed. New snippets are being processed in
 * the background; the user should head back to /results to see them
 * appear (the page polls /api/results/state on a 10s tick).
 * ------------------------------------------------------------------------- */

function CompleteCard() {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-sm">
      <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary" aria-hidden />
      <h2 className="mb-2 text-lg font-semibold tracking-tight">
        New snippets coming up
      </h2>
      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
        We&apos;re processing your re-performance now. Your fresh
        snippets will appear on your Voice Journey in a moment.
      </p>
      <Button asChild className="rounded-full">
        <Link href="/chat">See your new snippets →</Link>
      </Button>
    </div>
  );
}
