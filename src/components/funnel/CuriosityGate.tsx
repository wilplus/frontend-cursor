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
 * - For guests: Signup form (no video)
 * - For logged-in users: Auto-claims then redirects
 *
 * After signup + claim: always redirects to /results/[sessionId]
 * (which shows the waiting screen with video until admin publishes).
 */
export default function CuriosityGate({
  isGuest,
  guestSessionId,
  onSuccess,
}: CuriosityGateProps) {
  const router = useRouter();
  const [signedUp, setSignedUp] = useState(false);

  // Claim guest session after user signs up (guests) or on mount (logged-in users)
  useEffect(() => {
    if (!guestSessionId) return;

    let unsubscribe: (() => void) | null = null;

    const claimSession = async (accessToken: string) => {
      let claimedSessionId: string | null = null;
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
          const data = await response.json();
          claimedSessionId = data?.session_id || null;
        } else {
          console.error("Claim failed:", response.status);
        }
      } catch (err) {
        console.error("Claim error:", err);
      }

      // Always go to results page — it shows waiting screen until published
      if (claimedSessionId) {
        router.push(`/results/${claimedSessionId}`);
      } else {
        // Fallback: check if there's a latest session
        try {
          const res = await fetch("/api/results/latest", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.session_id) {
              router.push(`/results/${data.session_id}`);
              return;
            }
          }
        } catch {
          /* fall through */
        }
        router.push("/chat");
      }
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

  const showRedirecting = !isGuest || signedUp;

  return (
    <main className="willab-chat min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
        {showRedirecting ? (
          <RedirectingCard />
        ) : (
          <GuestSignupSection onSuccess={onSuccess} />
        )}
      </div>
    </main>
  );
}
