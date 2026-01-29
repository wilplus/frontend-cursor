"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Returns true once Supabase has a session (avoids race where API calls run before session is restored from storage).
 * Use before calling any API that needs Authorization (e.g. fetchSessionStatus, fetchUserRecordings).
 */
export function useAuthReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const check = (session: { access_token?: string } | null) => {
      if (session?.access_token) setReady(true);
    };

    supabase.auth.getSession().then(({ data: { session } }) => check(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      check(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return ready;
}
