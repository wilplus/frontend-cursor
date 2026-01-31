"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Returns true once Supabase has a session (avoids race where API calls run before session is restored from storage).
 * Use before calling any API that needs Authorization (e.g. fetchSessionStatus, fetchUserRecordings).
 * On "Invalid Refresh Token" / "Refresh Token Not Found", signs out and redirects to login.
 */
export function useAuthReady(): boolean {
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const check = (session: { access_token?: string } | null) => {
      if (session?.access_token) setReady(true);
    };

    const handleRefreshTokenError = () => {
      supabase.auth.signOut();
      router.replace("/login");
    };

    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error?.message?.includes?.("Refresh Token") || error?.message?.includes?.("Not Found")) {
          handleRefreshTokenError();
          return;
        }
        check(session);
      })
      .catch((err: unknown) => {
        const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "";
        if (msg.includes("Refresh Token") || msg.includes("refresh_token")) {
          handleRefreshTokenError();
        }
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      check(session);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return ready;
}
