"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { readSession } from "@/lib/supabase/session";

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

/* What the probe last found in this tab, for a screen that opens on it. */
let lastKnown: boolean | null = null;

/** `fromLast`: start from what this tab last found rather than null, so a
 *  screen opened again draws at once (the probe still runs and corrects it). */
export function useSignedIn(fromLast = false): boolean | null {
  const [signedIn, setSignedInState] = useState<boolean | null>(() => (fromLast ? lastKnown : null));

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const setSignedIn = (value: boolean) => {
      lastKnown = value;
      setSignedInState(value);
    };

    readSession()
      .then((session) => {
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
