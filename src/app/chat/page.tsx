"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import ChatInterview from "@/components/funnel/ChatInterview";
import { Button } from "@/components/ui/button";
import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type ChatState = "loading" | "interviewing" | "complete" | "error";

/* -------------------------------------------------------------------------- */
/* Training Complete Screen                                                   */
/* -------------------------------------------------------------------------- */

function TrainingCompleteScreen() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center animate-fade-in-up">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="h-8 w-8 text-primary" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          Training complete for today
        </h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Great work! Your session has been recorded. Check back for updated
          insights from your coach.
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

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceSnippet = searchParams.get("sourceSnippet");
  const intent = searchParams.get("intent") as "charisma" | "stress" | null;

  const [chatState, setChatState] = useState<ChatState>("loading");
  const [initialQuestion, setInitialQuestion] = useState<{
    text: string;
    tone: "charisma" | "stress";
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchedRef = useRef(false);

  // Fetch the contextual first question on mount
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchFirstQuestion = async () => {
      try {
        const token = await getAuthToken();
        if (!token) {
          router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          return;
        }

        // If we have source snippet context, fetch contextual question
        if (sourceSnippet && intent) {
          const url = `/api/results/chat/first-question?sourceSnippetId=${encodeURIComponent(sourceSnippet)}&intent=${encodeURIComponent(intent)}`;
          const res = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            if (res.status === 401) {
              router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
              return;
            }
            // If snippet context unavailable, fall back to generic interview
            if (res.status === 422 || data?.code === "SNIPPET_CONTEXT_UNAVAILABLE") {
              // Start generic interview (no initial question → ChatInterview fetches its own)
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

    fetchFirstQuestion();
  }, [sourceSnippet, intent, router]);

  // When the 30s threshold is reached, show "Training Complete"
  const handleThresholdReached = useCallback(() => {
    setChatState("complete");
  }, []);

  const handleError = useCallback(
    (code: string) => {
      if (code === "RATE_LIMITED") {
        setErrorMsg("Too many recordings. Please wait a few minutes and try again.");
        setChatState("error");
      } else if (code === "GUEST_FUNNEL_DISABLED") {
        setErrorMsg("Chat is temporarily unavailable. Please try again later.");
        setChatState("error");
      }
    },
    []
  );

  // Determine farewell message based on intent
  const farewell =
    intent === "stress"
      ? "That's all for today's session. Great work opening up — we'll analyze this for you! 🙌"
      : "Training complete for today! We've captured everything we need. 🚀";

  return (
    <main className="willab-chat min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        {chatState === "loading" && (
          <div className="flex min-h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {chatState === "error" && (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
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
          />
        )}

        {chatState === "complete" && <TrainingCompleteScreen />}
      </div>
    </main>
  );
}
