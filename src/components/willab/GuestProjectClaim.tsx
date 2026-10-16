"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { claimGuestProjects } from "@/services/api/projects";
import { sendPendingTrainingYes } from "@/lib/legal/pendingTrainingYes";
import { afterChatBoot } from "@/lib/chatBoot";

/** Completes the guest-owner handoff after any signup or login round-trip,
 *  then sends a training yes the visitor gave before signing in. */
export default function GuestProjectClaim() {
  useEffect(() => {
    const supabase = createClient();
    // A visitor's training yes follows the claim: the grant needs the
    // acceptance the claim brings into the account (pendingTrainingYes.ts).
    const claim = () => void claimGuestProjects().then(() => sendPendingTrainingYes());
    // A page opened with a session already in place: a guest token still on
    // the device is claimed in the background, after the thread has painted
    // (founder 2026-10-16, Q4), not in the boot burst. A fresh sign-in on
    // this page (SIGNED_IN below) claims at once, as before.
    let cancelDeferred: (() => void) | null = null;
    let unmounted = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (unmounted || !data.session?.access_token) return;
      cancelDeferred = afterChatBoot(claim);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.access_token) claim();
    });
    return () => {
      unmounted = true;
      cancelDeferred?.();
      subscription.unsubscribe();
    };
  }, []);
  return null;
}
