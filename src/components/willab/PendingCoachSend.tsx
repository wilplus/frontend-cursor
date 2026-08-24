"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendTakeToCoach } from "@/services/api/sendTakeToCoach";
import { claimGuestProjects } from "@/services/api/projects";
import { mergeLocalLoungeThreadToServer } from "@/lib/funnel/loungeLocalThread";
import { clearParked } from "./willabParked";
import {
  clearPendingSend,
  getPendingSend,
  setReviewPending,
} from "./sendStatus";

/** Completes a parked guest Project Take handoff after authentication. */
export default function PendingCoachSend() {
  const inFlightRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    const run = async () => {
      if (inFlightRef.current) return;
      const pending = getPendingSend();
      if (!pending) return;

      inFlightRef.current = true;
      try {
        // The guest graph must become account-owned before the strict send
        // endpoint can resolve this Project and Take.
        if (!(await claimGuestProjects())) return;
        try {
          await mergeLocalLoungeThreadToServer();
        } catch {
          /* best-effort — coach delivery is the durable handoff */
        }
        const result = await sendTakeToCoach(pending.projectId, pending.takeId);
        if (result.kind === "sent") {
          clearPendingSend();
          clearParked();
          setReviewPending(pending.takeId);
          window.location.href = "/chat";
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    const recheck = () => {
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session?.access_token) void run();
      });
    };

    recheck();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.access_token) void run();
    });

    const onForeground = () => {
      if (document.visibilityState === "visible") recheck();
    };
    document.addEventListener("visibilitychange", onForeground);
    window.addEventListener("focus", onForeground);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onForeground);
      window.removeEventListener("focus", onForeground);
    };
  }, []);

  return null;
}
