"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* -------------------------------------------------------------------------- */
/*  useSignedIn — lightweight auth probe for the Lounge                         */
/*                                                                            */
/*  This NEVER redirects: the Lounge is the unsigned                           */
/*  home, so "signed out" is a first-class state, not an error. Returns:       */
/*    null  → still resolving (don't mount the thread yet)                     */
/*    false → no session (Lounge persists to localStorage)                     */
/*    true  → session present (Lounge persists to server `lounge_messages`)    */
/*  Tracks `onAuthStateChange` so a sign-in mid-session flips it live.         */
/* -------------------------------------------------------------------------- */

export function useSignedIn(): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (active) setSignedIn(Boolean(session?.access_token));
      })
      .catch(() => {
        if (active) setSignedIn(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.access_token));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return signedIn;
}
