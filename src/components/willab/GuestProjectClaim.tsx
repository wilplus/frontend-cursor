"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { claimGuestProjects } from "@/services/api/projects";
import { sendPendingTrainingYes } from "@/lib/legal/pendingTrainingYes";

/** Completes the guest-owner handoff after any signup or login round-trip,
 *  then sends a training yes the visitor gave before signing in. */
export default function GuestProjectClaim() {
  useEffect(() => {
    const supabase = createClient();
    // A visitor's training yes follows the claim: the grant needs the
    // acceptance the claim brings into the account (pendingTrainingYes.ts).
    const claim = () => void claimGuestProjects().then(() => sendPendingTrainingYes());
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) claim();
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.access_token) claim();
    });
    return () => subscription.unsubscribe();
  }, []);
  return null;
}
