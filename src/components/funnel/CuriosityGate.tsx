"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
 * Brief interstitial shown while we determine where to redirect after claim.
 */
function RedirectingCard() {
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-muted/40 px-5 py-6 text-center shadow-sm">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">Setting up your account…</p>
    </div>
  );
}

/**
 * Curiosity Gate: Post-recording flow
 *
 * Shows the explainer video, then:
 * - For guests: Signup form below the video
 * - For logged-in users: Auto-claims then redirects
 *
 * After signup + claim: redirects to /results (if published snippets exist)
 * or /chat (to start a new conversation).
 */
export default function CuriosityGate({
  isGuest,
  guestSessionId,
  onSuccess,
}: CuriosityGateProps) {
  const router = useRouter();
  const [signedUp, setSignedUp] = useState(false);

  // After claim, determine redirect target and navigate
  const redirectAfterClaim = async (accessToken: string) => {
    try {
      // Check if user already has published results
      const res = await fetch("/api/results/latest", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.session_id && data.status === "completed") {
          router.push(`/results/${data.session_id}`);
          return;
        }
      }
    } catch {
      /* non-fatal — fall through to /chat */
    }
    // No published results yet → go to chat (or home)
    router.push("/chat");
  };

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
      // Redirect regardless of claim outcome
      await redirectAfterClaim(accessToken);
    };

    const setupAuthListener = async () => {
      const supabase = createClient();

      if (isGuest) {
        // Wait for SIGNED_IN after signup
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "SIGNED_IN" && session?.access_token) {
            setSignedUp(true);
            claimSession(session.access_token);
          }
        });
        unsubscribe = data?.subscription?.unsubscribe || null;
      } else {
        // Logged-in users: claim + redirect immediately
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, guestSessionId]);

  // Show:
  //   - logged-in user or post-signup → brief "redirecting" card
  //   - guest (pre-signup) → video + signup form
  const showRedirecting = !isGuest || signedUp;

  return (
    <main className="willab-chat min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
        {!showRedirecting && <ExplainerVideo />}
        {showRedirecting ? (
          <RedirectingCard />
        ) : (
          <GuestSignupSection onSuccess={onSuccess} />
        )}
      </div>
    </main>
  );
}
