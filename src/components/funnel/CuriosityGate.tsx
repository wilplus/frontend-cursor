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

function LoggedInSection() {
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border bg-background/95 p-6 shadow-xl backdrop-blur-sm">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Analysis in Progress</h2>
        <p className="text-sm text-muted-foreground">
          We're analyzing your voice. We'll email you when your Charisma Snippets are ready.
        </p>
        <div className="flex items-center gap-2 pt-2">
          <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
          <p className="text-xs text-muted-foreground">Processing...</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Curiosity Gate: Post-recording flow
 *
 * Shows the explainer video, then:
 * - For guests: Email capture + signup form
 * - For logged-in users: Waiting message
 *
 * On guest signup, claims the guest session and fires onSuccess callback.
 */
export default function CuriosityGate({
  isGuest,
  guestSessionId,
  onSuccess,
}: CuriosityGateProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Listen for auth state changes to claim the guest session after signup
  useEffect(() => {
    if (!isGuest || !guestSessionId) return;

    let unsubscribe: (() => void) | null = null;

    const setupAuthListener = async () => {
      const supabase = createClient();
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session?.access_token) {
          setIsAuthenticating(true);
          // Claim the guest session with the new user
          fetch("/api/public/shaky-voice/claim", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ guest_session_id: guestSessionId }),
          })
            .then((res) => {
              if (res.ok) {
                onSuccess();
              } else {
                console.error("Claim failed:", res.status);
                setIsAuthenticating(false);
              }
            })
            .catch((err) => {
              console.error("Claim error:", err);
              setIsAuthenticating(false);
            });
        }
      });

      unsubscribe = data?.subscription?.unsubscribe || null;
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

        {isAuthenticating ? (
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
          <LoggedInSection />
        )}
      </div>
    </main>
  );
}
