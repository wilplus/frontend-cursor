"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { mergeSession } from "@/services/api/mergeSession";
import { mergeLocalLoungeThreadToServer } from "@/lib/funnel/loungeLocalThread";
import { clearParked } from "./willabParked";
import {
  clearPendingSend,
  getPendingSend,
  setReviewPending,
} from "./sendStatus";

/* -------------------------------------------------------------------------- */
/*  WillabPendingSend — global post-auth merge-then-send (§3.5 / §13 Path 2)   */
/*                                                                            */
/*  Mounted in the root layout (like PendingSessionClaim) so it bridges the     */
/*  OAuth round-trip regardless of where the callback lands. On the first       */
/*  signed-in pass it reads the parked recording's session_id and, IN ORDER:    */
/*    a. merges the local Lounge thread → server (chronological, idempotent);   */
/*    b. claims + sends the recording via mergeSession;                         */
/*    c. on send SUCCESS only (§3.6) marks review_pending + lands on /chat.     */
/*  Bails instantly when there's no pending willab send. inFlightRef guards a    */
/*  double SIGNED_IN. A failed send leaves the id in place to retry next load.  */
/* -------------------------------------------------------------------------- */

export default function WillabPendingSend() {
  const inFlightRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    const run = async () => {
      if (inFlightRef.current) return;
      const pendingId = getPendingSend();
      if (!pendingId) return;

      inFlightRef.current = true;
      try {
        // a. merge the Lounge thread BEFORE the send (ordering is load-bearing).
        try {
          await mergeLocalLoungeThreadToServer();
        } catch {
          /* best-effort — the send is what matters */
        }
        // b + c. claim + send; confirmation only on send success.
        const r = await mergeSession(pendingId);
        if (r.kind === "sent") {
          clearPendingSend();
          clearParked();
          setReviewPending(pendingId);
          // Full load so the willab flow re-derives state → review_pending.
          window.location.href = "/chat";
        }
        // else: leave the pending id for a retry on the next load / sign-in.
      } finally {
        inFlightRef.current = false;
      }
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) void run();
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.access_token) void run();
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
