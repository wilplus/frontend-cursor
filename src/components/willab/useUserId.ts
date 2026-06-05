"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* -------------------------------------------------------------------------- */
/*  useUserId — the signed-in user's id (for usePublishLiveSubscription)        */
/*                                                                            */
/*  The realtime publish sub filters `v2_sessions` row-changes by `user_id`,    */
/*  so it needs the id, not the signed-in boolean. null while resolving or       */
/*  signed out (the sub is then a no-op). Mirrors useSignedIn's auth tracking.  */
/* -------------------------------------------------------------------------- */

export function useUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (active) setUserId(session?.user?.id ?? null);
      })
      .catch(() => {
        if (active) setUserId(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return userId;
}
