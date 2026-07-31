"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserProfile } from "@/components/willab/useUserProfile";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { loadLifeState, subscribeLifeState } from "@/lib/life/useLifeState";
import { panelMenu } from "@/lib/life/menu";
import type { LifeMenuEntry } from "@/lib/life/types";
import { useTokenWallet, type TokenWallet } from "@/hooks/useTokenWallet";
import { TOKENS_COPY, formatShortDate, formatTokens } from "@/components/tokens/copy";

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
  /** The token wallet (token pricing, Phase 1). Lives here for the same reason
   *  credits do: BOTH headers mount the same AppMenu, and a second copy of
   *  this effect in SiteHeader is exactly the duplication that let the two
   *  menus drift apart the first time.
   *
   *  `wallet.enabled === true` also RETIRES the legacy credits row — see the
   *  note on AppMenu's `tokensEnabled`. */
  wallet: TokenWallet;
  /** The token balance formatted for the menu row, or null when pricing is off
   *  or the balance is unreadable. Derived here so both header mounts show the
   *  same label without either learning how a balance is read or formatted. */
  tokensLabel: string | null;
  lifeMenu: LifeMenuEntry[];
  loggingOut: boolean;
  logout: () => void;
}

export function useAppMenuData(): AppMenuData {
  const router = useRouter();
  // Makes no request while signed out, so the blog mount pays nothing for it.
  const { isCoach } = useUserProfile();
  const supabase = createClient();
  const [authState, setAuthState] = useState<AuthState>("unknown");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  // The Life Panel's entries, straight from `GET /v2/life/state`. Empty for
  // everyone the panel is not on for, which is the normal case: that endpoint
  // 404s unless the feature is enabled AND this user passes the gate. We render
  // what the payload contains and nothing more (N1), so a surface the server
  // omits cannot appear, and nothing is rendered greyed out as "coming soon".
  const [lifeMenu, setLifeMenu] = useState<LifeMenuEntry[]>([]);

  /** Auth identity for the menu. No balance polling lives here any more: the
   *  token wallet owns its own read (useTokenWallet), and the legacy credits
   *  poll against /status is gone with the credits system. */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setAuthState("anonymous");
        setUserEmail(null);
        return;
      }
      setAuthState("signed_in");
      setUserEmail(user.email ?? null);
    }

    void load();

    return () => {
      cancelled = true;
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

  // Signed-in only: a guest has no wallet, and the probe is skipped entirely
  // rather than fired and thrown away.
  const wallet = useTokenWallet(authState === "signed_in");
  // Unreadable balance → NO row rather than a zero: a zero is indistinguishable
  // from being out of tokens, and this row is the only place the balance now
  // appears.
  const tokensLabel =
    wallet.enabled === true && wallet.balance.kind === "ready"
      ? TOKENS_COPY.menuRowValue(
          formatTokens(wallet.balance.balance),
          formatShortDate(wallet.balance.periodEndsAt)
        )
      : null;
  return {
    authState,
    isCoach,
    userEmail,
    wallet,
    tokensLabel,
    lifeMenu,
    loggingOut,
    logout,
  };
}
