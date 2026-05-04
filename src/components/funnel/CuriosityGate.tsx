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
  // For logged-in users we show the "homework being processed" banner
  // immediately and run the session-claim silently in the background.
  // For guests we show the signup form first, then flip to the banner the
  // moment the SIGNED_IN event fires (claim still runs silently after).
  const [signedUp, setSignedUp] = useState(false);

  // Claim guest session after user signs up (guests) or on mount (logged-in users)
  useEffect(() => {
    if (!guestSessionId) return;

    let unsubscribe: (() => void) | null = null;

    const claimSession = async (accessToken: string) => {
      try {
        const response = await fetch("/api/public/shaky-voice/claim", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ guest_session_id: guestSessionId }),
        });
        if (!response.ok) {
          console.error("Claim failed:", response.status);
        }
      } catch (err) {
        console.error("Claim error:", err);
      }
    };

    const setupAuthListener = async () => {
      const supabase = createClient();

      if (isGuest) {
        // Wait for SIGNED_IN after signup; flip the UI to the banner the
        // instant auth flips, regardless of whether the claim has finished.
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "SIGNED_IN" && session?.access_token) {
            setSignedUp(true);
            claimSession(session.access_token);
          }
        });
        unsubscribe = data?.subscription?.unsubscribe || null;
      } else {
        // Logged-in users: claim in the background; UI already shows the
        // banner so there's nothing to wait for here.
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
  }, [isGuest, guestSessionId]);

  // Match the spec exactly:
  //   - logged-in user        → video + "homework being processed" banner
  //   - guest (pre-signup)    → video + signup form
  //   - guest (post-signup)   → video + same banner as logged-in
  const showBanner = !isGuest || signedUp;

  return (
    <main className="willab-chat min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
        <ExplainerVideo />
        {showBanner ? (
          <SubmittedWaitingCard />
        ) : (
          <GuestSignupSection onSuccess={onSuccess} />
        )}
      </div>
    </main>
  );
}
