"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { claimGuestProjects } from "@/services/api/projects";

/** Completes the guest-owner handoff after any signup or login round-trip. */
export default function GuestProjectClaim() {
  useEffect(() => {
    const supabase = createClient();
    const claim = () => void claimGuestProjects();
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
