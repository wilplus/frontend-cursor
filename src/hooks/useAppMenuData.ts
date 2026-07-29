"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserProfile } from "@/components/willab/useUserProfile";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { homeworkApi } from "@/lib/api/homework-client";
import { loadLifeState, subscribeLifeState } from "@/lib/life/useLifeState";
import { panelMenu } from "@/lib/life/menu";
import type { LifeMenuEntry } from "@/lib/life/types";

/* -------------------------------------------------------------------------- */
/*  useAppMenuData (FE-3) — everything AppMenu renders, loaded once            */
/*                                                                            */
/*  Extracted from DashboardHeader so the blog mount is a real mount of the    */
/*  same menu rather than a lookalike: "signed-out on the blog: no email row,  */
/*  no credits row" implies signed IN on the blog shows them, which means the  */
/*  blog needs the same auth, credits and panel-gate reads. Duplicating those  */
/*  three effects into SiteHeader is precisely the copy the story rules out —  */
/*  the two would drift on the next change, the same way the menus did.        */
/* -------------------------------------------------------------------------- */

export type AuthState = "unknown" | "anonymous" | "signed_in";

export interface AppMenuData {
  authState: AuthState;
  /** Drives the coach-only rows (N4). False for everyone else, including
   *  while the profile is still loading — a row that flickers in for a
   *  non-coach is the same leak as one that stays. */
  isCoach: boolean;
  userEmail: string | null;
  credits: number | null;
  lifeMenu: LifeMenuEntry[];
  loggingOut: boolean;
  logout: () => void;
  /** DashboardHeader's post-checkout toast writes the fresh balance back. */
  setCredits: (n: number | null) => void;
}

export function useAppMenuData(): AppMenuData {
  const router = useRouter();
  // Makes no request while signed out, so the blog mount pays nothing for it.
  const { isCoach } = useUserProfile();
  const supabase = createClient();
  const [authState, setAuthState] = useState<AuthState>("unknown");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  // The Life Panel's entries, straight from `GET /v2/life/state`. Empty for
  // everyone the panel is not on for, which is the normal case: that endpoint
  // 404s unless the feature is enabled AND this user passes the gate. We render
  // what the payload contains and nothing more (N1), so a surface the server
  // omits cannot appear, and nothing is rendered greyed out as "coming soon".
  const [lifeMenu, setLifeMenu] = useState<LifeMenuEntry[]>([]);

  /** Credits: single source of truth — the same field the homework flow reads. */
  useEffect(() => {
    let cancelled = false;

    async function refreshCreditsFromStatus() {
      try {
        const status = await homeworkApi.getStatus();
        if (!cancelled) setCredits(status?.credits != null ? status.credits : null);
      } catch {
        if (!cancelled) setCredits(null);
      }
    }

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setAuthState("anonymous");
        setUserEmail(null);
        setCredits(null);
        return;
      }
      setAuthState("signed_in");
      setUserEmail(user.email ?? null);
      await refreshCreditsFromStatus();
    }

    void load();

    // Only attach the refresh listeners once we know the user is signed in —
    // guests have no credits and shouldn't trigger /status in the background.
    let cleanupListeners: (() => void) | null = null;
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      const onVisibilityOrFocus = () => {
        if (typeof document !== "undefined" && document.visibilityState !== "visible")
          return;
        void refreshCreditsFromStatus();
      };
      window.addEventListener("focus", onVisibilityOrFocus);
      document.addEventListener("visibilitychange", onVisibilityOrFocus);
      const intervalId = window.setInterval(() => {
        void refreshCreditsFromStatus();
      }, 60_000);
      cleanupListeners = () => {
        window.removeEventListener("focus", onVisibilityOrFocus);
        document.removeEventListener("visibilitychange", onVisibilityOrFocus);
        window.clearInterval(intervalId);
      };
    });

    return () => {
      cancelled = true;
      cleanupListeners?.();
    };
  }, [supabase]);

  /** One read of the panel gate per page load (the promise is cached in
   *  `useLifeState`). A 404 resolves to null and leaves the menu identical to
   *  today: no entries, no error, no console noise. Signed-in only, because the
   *  panel is signed-in only and a guest read would just be a wasted 401.
   *
   *  The subscription is what makes the menu grow the moment setup completes,
   *  without a page reload. */
  useEffect(() => {
    if (authState !== "signed_in") {
      setLifeMenu([]);
      return;
    }
    let cancelled = false;
    const apply = (state: Parameters<typeof panelMenu>[0]) => {
      if (!cancelled) setLifeMenu(panelMenu(state));
    };
    void loadLifeState().then(apply);
    const unsubscribe = subscribeLifeState(apply);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [authState]);

  const logout = useCallback(() => {
    setLoggingOut(true);
    void (async () => {
      try {
        await supabase.auth.signOut();
        router.push("/login");
      } catch (err) {
        console.error(err);
        toast.error("Logout failed");
      } finally {
        setLoggingOut(false);
      }
    })();
  }, [supabase, router]);

  return {
    authState,
    isCoach,
    userEmail,
    credits,
    lifeMenu,
    loggingOut,
    logout,
    setCredits,
  };
}
