"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import SignupForm from "@/components/auth/SignupForm";
import { createClient } from "@/lib/supabase/client";
import { clearPendingSessionId } from "@/lib/funnel/pendingSession";

interface CuriosityGateProps {
  isGuest: boolean;
  guestSessionId: string | null;
  onSuccess: () => void;
}

/**
 * Funnel-flavoured signup pane — ultra-minimal.
 *
 * Brand presence comes from the GlobalHeader (DashboardHeader) up the tree;
 * the card itself is just the auth options. No conversational headline or
 * subheadline — the LinkedIn / Email buttons are the first thing the eye
 * lands on.
 *
 * The single "Already have an account? Sign in" link lives inside the
 * SignupForm card and is the canonical entry to /login.
 */
function GuestSignupSection({ onSuccess }: { onSuccess: () => void }) {
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border bg-background/95 p-4 shadow-xl backdrop-blur-sm sm:p-5">
      <SignupForm onSuccess={onSuccess} />
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
          // Clear the localStorage stash so the global PendingSessionClaim
          // hook doesn't fire a duplicate claim with the same id later.
          clearPendingSessionId();
        } else {
          console.error(
            `funnel.session_claim_failed surface=fe source=curiosity_gate status=${response.status}`
          );
        }
      } catch (err) {
        console.error("funnel.session_claim_error surface=fe source=curiosity_gate", err);
      }

      // All post-claim flows land on /chat — the chat page owns the
      // entire post-onboarding user journey now (waiting screen,
      // snippet review, roleplay). /chat's phase state machine
      // decides what to render based on the session's current status
      // (polling while processing → review when completed → roleplay).
      if (claimedSessionId) {
        router.push(`/chat?session=${encodeURIComponent(claimedSessionId)}`);
      } else {
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
