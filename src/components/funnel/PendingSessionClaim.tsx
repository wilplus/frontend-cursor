"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  clearPendingSessionId,
  getPendingSessionId,
} from "@/lib/funnel/pendingSession";

/**
 * Global post-auth claim — bridges the OAuth round-trip.
 *
 * The cold-start funnel records audio anonymously (yielding a
 * `guest_session_id`) before signup. HeroRecorder stashes that id in
 * localStorage at the moment the recording threshold is reached. When the
 * user later authenticates — via LinkedIn OAuth, magic-link, or any flow
 * that destroys React state — this component runs once on mount, picks
 * the id back up, and POSTs to the claim endpoint so the backend can link
 * the anonymous session to the new user account. On success we clear the
 * id and route them to /results so they see their Voice Journey
 * (or the "we're analysing your baseline" waiting state).
 *
 * Renders nothing — pure side-effect. Safe to mount in the root layout
 * because:
 *   - When there's no pending id, every code path bails immediately.
 *   - When there's no Supabase session, we don't claim and don't redirect.
 *   - inFlightRef gates concurrent SIGNED_IN events so we never double-POST.
 */
export default function PendingSessionClaim() {
  const router = useRouter();
  const pathname = usePathname();
  const inFlightRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    const claim = async (accessToken: string) => {
      if (inFlightRef.current) return;
      const pendingId = getPendingSessionId();
      if (!pendingId) return;

      inFlightRef.current = true;
      try {
        // Post-OAuth backstop uses the dedicated /auth/merge-session
        // endpoint (vs. the cold-start funnel's /public/shaky-voice/claim).
        // Both call the same atomic helper on the backend; the split is
        // purely semantic so logs and metrics stay clean.
        const res = await fetch("/api/auth/merge-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ anonymous_session_id: pendingId }),
        });

        if (res.ok) {
          // Backend may return the linked session_id — prefer the deep
          // link to /results/[id] when we have it; fall back to the
          // overview otherwise.
          const data = (await res.json().catch(() => ({}))) as {
            session_id?: string;
          };
          clearPendingSessionId();

          // Don't bounce the user if they're already on results / admin /
          // dashboard — they're in the right place. Only redirect from
          // pages where staying put doesn't make sense after auth.
          const target = data.session_id
            ? `/results/${encodeURIComponent(data.session_id)}`
            : "/results";
          if (
            pathname &&
            !pathname.startsWith("/results") &&
            !pathname.startsWith("/admin") &&
            !pathname.startsWith("/dashboard")
          ) {
            router.push(target);
          }
        } else {
          // Leave the id in storage so a refresh / next sign-in can retry.
          // (Don't surface as a toast — this runs silently in the bg.)
          console.error("PendingSessionClaim: claim failed", res.status);
        }
      } catch (err) {
        console.error("PendingSessionClaim: claim error", err);
      } finally {
        inFlightRef.current = false;
      }
    };

    // First pass on mount: cover the post-OAuth landing where SIGNED_IN
    // already fired before this component mounted (the redirect happened
    // outside the React tree).
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) {
        void claim(data.session.access_token);
      }
    });

    // Second pass — subscribe for future auth-state changes (e.g. inline
    // signup that flips SIGNED_IN with this component already mounted).
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session?.access_token) {
          void claim(session.access_token);
        }
      }
    );

    return () => {
      subscription.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
