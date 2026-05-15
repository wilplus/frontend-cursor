"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import Lottie from "lottie-react";
import ChatInterview from "@/components/funnel/ChatInterview";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { getAuthToken } from "@/lib/api/auth-client";

type ChatState = "loading" | "interviewing" | "complete" | "error";

const VOICE_LOADING_PHRASES = [
  "Analyzing your charisma markers…",
  "Mapping stress patterns…",
  "Detecting filler-word density…",
  "Tuning into your vocal energy…",
  "Finalizing your insights…",
] as const;

function shufflePhrases(phrases: readonly string[]): string[] {
  const shuffled = [...phrases];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function TrainingCompleteScreen({
  sessionId,
}: {
  /**
   * Session ID captured from ChatInterview's onThresholdReached
   * callback. When present we deep-link straight to
   * /results/[sessionId] which renders ProcessingState until the
   * backend finishes analysis, then the snippets. Falls back to
   * the generic /results index when missing (defensive — should
   * always be present in practice since the upload flow captures
   * it on turn 1).
   */
  sessionId: string | null;
}) {
  const router = useRouter();
  const [lottieData, setLottieData] = useState<object | null>(null);
  const [phrases] = useState<string[]>(() => shufflePhrases(VOICE_LOADING_PHRASES));
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/animations/loading.json")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setLottieData(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % phrases.length);
    }, 1800);
    return () => clearInterval(id);
  }, [phrases.length]);

  // /results/[sessionId] handles its own state: ProcessingState
  // waiting screen until backend finalize completes, then the real
  // results (Charisma dashboard + snippet cards). Generic /results
  // is the safety net when sessionId is somehow missing.
  useEffect(() => {
    const target = sessionId
      ? `/results/${encodeURIComponent(sessionId)}`
      : "/results";
    const t = setTimeout(() => router.push(target), 4500);
    return () => clearTimeout(t);
  }, [router, sessionId]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center animate-fade-in-up">
      <div className="h-24 w-24 opacity-80">
        {lottieData ? (
          <Lottie animationData={lottieData} loop />
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        )}
      </div>
      <p className="mx-auto max-w-sm text-sm text-muted-foreground min-h-[1.25rem] transition-opacity duration-300">
        {phrases[phraseIndex]}
      </p>
    </div>
  );
}

export default function ChatPageClient({
  sourceSnippet,
  intent,
}: {
  sourceSnippet: string | null;
  intent: "charisma" | "stress" | null;
}) {
  const router = useRouter();

  const [chatState, setChatState] = useState<ChatState>("loading");
  const [initialQuestion, setInitialQuestion] = useState<{
    text: string;
    tone: "charisma" | "stress";
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /**
   * Session ID captured from ChatInterview when the chat ends
   * (via duration threshold, contextual turn cap, or user-tapped
   * Finish button). Forwarded to <TrainingCompleteScreen> so we
   * can deep-link to /results/[sessionId] instead of the generic
   * /results index — important for contextual chats where the
   * "latest session" heuristic could surface the wrong session
   * in races.
   */
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(
    null
  );
  /**
   * Captured at first-question fetch time so ChatInterview can forward
   * it to upload-answer for the backend's contextual-chat outcome eval
   * (services/coaching_outcomes.py). Held in state because the chat
   * mounts asynchronously after the token round-trip.
   */
  const [authToken, setAuthToken] = useState<string | null>(null);

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchFirstQuestion = async () => {
      try {
        const token = await getAuthToken();
        if (!token) {
          router.push(
            `/login?redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`
          );
          return;
        }
        // Cache for ChatInterview → upload-answer to forward; the
        // contextual outcome-eval branch on the backend needs a
        // verified bearer token to derive the user_id.
        setAuthToken(token);

        if (sourceSnippet && intent) {
          const url = `/api/results/chat/first-question?sourceSnippetId=${encodeURIComponent(sourceSnippet)}&intent=${encodeURIComponent(intent)}`;
          const res = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            if (res.status === 401) {
              router.push(
                `/login?redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`
              );
              return;
            }
            if (res.status === 422 || data?.code === "SNIPPET_CONTEXT_UNAVAILABLE") {
              // Snippet doesn't have what backend needs to seed a
              // contextual chat (missing transcript / admin_comment /
              // audio_url). Previously this fell through to
              // setChatState("interviewing") with no initialQuestion,
              // which boots the cold-start onboarding chain — the user
              // saw "First we need your baseline. Forgive the odd
              // opener, but do you generally like math?" on a
              // contextual click, which is the wrong flow entirely.
              // Now we surface an explicit error + "Back to Results"
              // so the user can pick a different snippet instead of
              // getting silently dropped into a baseline interview.
              setErrorMsg(
                "We couldn't open this snippet's chat — its transcript or coach note isn't ready yet."
              );
              setChatState("error");
              return;
            }
            throw new Error(data?.error || `Failed (HTTP ${res.status})`);
          }

          const data = await res.json();
          if (data.question) {
            setInitialQuestion({
              text: data.question,
              tone: intent || "charisma",
            });
          }
        }

        setChatState("interviewing");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to start chat");
        setChatState("error");
      }
    };

    void fetchFirstQuestion();
  }, [sourceSnippet, intent, router]);

  const handleThresholdReached = useCallback((guestSessionId: string) => {
    setCompletedSessionId(guestSessionId);
    setChatState("complete");
  }, []);

  const handleError = useCallback((code: string) => {
    if (code === "RATE_LIMITED") {
      setErrorMsg("Too many recordings. Please wait a few minutes and try again.");
      setChatState("error");
    } else if (code === "GUEST_FUNNEL_DISABLED") {
      setErrorMsg("Chat is temporarily unavailable. Please try again later.");
      setChatState("error");
    }
  }, []);

  const farewell =
    intent === "stress"
      ? "That's all for today's session. Great work opening up — we'll analyze this for you! 🙌"
      : "Training complete for today! We've captured everything we need. 🚀";

  // Viewport-locked: outer fills the device exactly; only the inner thread
  // scrolls if its messages overflow. The body never scrolls.
  return (
    <main className="willab-chat flex h-full flex-col overflow-hidden bg-background">
      <div className="shrink-0">
        <DashboardHeader />
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-4 py-8">
        {chatState === "loading" && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {chatState === "error" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              {errorMsg || "Something went wrong."}
            </p>
            <Link href="/results">
              <Button variant="outline" size="sm">
                Back to Results
              </Button>
            </Link>
          </div>
        )}

        {chatState === "interviewing" && (
          <ChatInterview
            onThresholdReached={handleThresholdReached}
            onError={handleError}
            initialQuestion={initialQuestion ?? undefined}
            farewellMessage={farewell}
            sourceSnippetId={sourceSnippet}
            authToken={authToken}
          />
        )}

        {chatState === "complete" && (
          <TrainingCompleteScreen sessionId={completedSessionId} />
        )}
      </div>
    </main>
  );
}

