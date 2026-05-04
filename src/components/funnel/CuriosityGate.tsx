"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import SignupForm from "@/components/auth/SignupForm";
import LoginForm from "@/components/auth/LoginForm";
import { createClient } from "@/lib/supabase/client";

interface CuriosityGateProps {
  isGuest: boolean;
  guestSessionId: string | null;
  onSuccess: () => void;
}

function ExplainerVideo() {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/public/funnel/afterwards-video")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const v = data?.video_url;
        if (typeof v === "string" && v) setUrl(v);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-muted">
        <p className="text-sm text-muted-foreground">Video unavailable</p>
      </div>
    );
  }

  return (
    <video
      src={url}
      className="aspect-video w-full rounded-xl bg-black shadow-sm"
      controls
      playsInline
      autoPlay
    />
  );
}

function GuestSignupSection({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<"signup" | "login">("signup");

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border bg-background/95 p-6 shadow-xl backdrop-blur-sm">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-semibold">Where should we send your Charisma Snippets?</h2>
        <p className="text-sm text-muted-foreground">
          Create a free account to get your personalized voice analysis.
        </p>
      </div>
      <div className="mt-6">
        {mode === "signup" ? (
          <SignupForm onSuccess={onSuccess} />
        ) : (
          <LoginForm onSuccess={onSuccess} />
        )}
      </div>
      <button
        type="button"
        onClick={() => setMode((m) => (m === "signup" ? "login" : "signup"))}
        className="mt-4 block w-full text-center text-sm text-muted-foreground underline"
      >
        {mode === "signup"
          ? "Already have an account? Log in"
          : "New here? Create an account"}
      </button>
    </div>
  );
}

/**
 * Waiting card shown after successful signup + claim.
 * Same visual style as the homework Step0WaitingCard.
 */
function SubmittedWaitingCard() {
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-muted/40 px-5 py-6 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 6v6l4 2" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <div className="mt-4 space-y-3">
        <p className="text-xl font-semibold text-foreground">Homework submitted!</p>
        <p className="text-sm leading-6 text-muted-foreground">
          Your recording has been sent and is now being reviewed. We'll email you when your Charisma Snippets are ready.
        </p>
      </div>
    </div>
  );
}

/**
 * Curiosity Gate: Post-recording flow
 *
 * Shows the explainer video, then:
 * - For guests: Signup form below the video
 * - For logged-in users: Auto-claims then shows waiting card
 *
 * After signup + claim: shows "Homework submitted!" waiting card.
 */
export default function CuriosityGate({
  isGuest,
  guestSessionId,
  onSuccess,
}: CuriosityGateProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [claimed, setClaimed] = useState(false);

  // Claim guest session after user signs up (guests) or on mount (logged-in users)
  useEffect(() => {
    if (!guestSessionId) return;

    let unsubscribe: (() => void) | null = null;

    const claimSession = async (accessToken: string) => {
      setIsAuthenticating(true);
      try {
        const response = await fetch("/api/public/shaky-voice/claim", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ guest_session_id: guestSessionId }),
        });

        if (response.ok) {
          // Show the waiting card instead of redirecting
          setClaimed(true);
          setIsAuthenticating(false);
        } else {
          console.error("Claim failed:", response.status);
          setIsAuthenticating(false);
        }
      } catch (err) {
        console.error("Claim error:", err);
        setIsAuthenticating(false);
      }
    };

    const setupAuthListener = async () => {
      const supabase = createClient();

      // For guests: wait for SIGNED_IN event after signup
      if (isGuest) {
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "SIGNED_IN" && session?.access_token) {
            claimSession(session.access_token);
          }
        });

        unsubscribe = data?.subscription?.unsubscribe || null;
      } else {
        // For logged-in users: claim immediately
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!error && session?.access_token) {
          claimSession(session.access_token);
        }
      }
    };

    setupAuthListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isGuest, guestSessionId, onSuccess]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
        <ExplainerVideo />

        {claimed ? (
          <SubmittedWaitingCard />
        ) : isAuthenticating ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-orange-500" />
              <p className="mt-2 text-sm text-muted-foreground">
                Setting up your account...
              </p>
            </div>
          </div>
        ) : isGuest ? (
          <GuestSignupSection onSuccess={onSuccess} />
        ) : (
          /* Logged-in users see a brief loader while auto-claim runs */
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-orange-500" />
              <p className="mt-2 text-sm text-muted-foreground">
                Processing your recording...
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
