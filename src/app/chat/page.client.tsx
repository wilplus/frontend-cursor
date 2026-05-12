"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import ChatInterview from "@/components/funnel/ChatInterview";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { getAuthToken } from "@/lib/api/auth-client";

type ChatState = "loading" | "interviewing" | "complete" | "error";

function TrainingCompleteScreen() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center animate-fade-in-up">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="h-8 w-8 text-primary" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Training complete for today</h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Great work! Your session has been recorded. Check back for updated insights from your
          coach.
        </p>
      </div>

      <Link href="/results">
        <Button variant="default" className="rounded-full mt-4">
          Back to My Results
        </Button>
      </Link>
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
              setChatState("interviewing");
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

  const handleThresholdReached = useCallback(() => {
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

        {chatState === "complete" && <TrainingCompleteScreen />}
      </div>
    </main>
  );
}

