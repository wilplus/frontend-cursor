"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import AppMenu from "@/components/AppMenu";
import { COMMUNITY_URL, SUPPORT_EMAIL } from "@/lib/appMenuLinks";
import { useAppMenuData } from "@/hooks/useAppMenuData";

/* -------------------------------------------------------------------------- */
/*  DashboardHeader — the lab's chrome.                                        */
/*                                                                            */
/*  FE-3 — the menu itself now lives in AppMenu and its data in                */
/*  useAppMenuData, so the blog mounts the SAME component rather than a        */
/*  lookalike. What stays here is what is genuinely lab-only: the logo.        */
/*                                                                            */
/*  The post-Stripe credits reconciliation is GONE with the credits system     */
/*  (founder 2026-07-31: tokens everywhere, credits nowhere). Token            */
/*  allowances arrive with the monthly period rather than a purchase, so there */
/*  is no checkout to return from and nothing to reconcile on arrival.         */
/* -------------------------------------------------------------------------- */

export default function DashboardHeader() {
  const menu = useAppMenuData();
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-4xl min-w-0 items-center justify-between gap-2 px-[15px] py-4 sm:gap-4">
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/"
            className="rounded transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="WillpowerLab home"
          >
            <Logo size="md" />
          </Link>
        </div>

        {/* The balance lives INSIDE the menu; the right side is just the
            hamburger. While auth is "unknown" AppMenu renders an invisible
            spacer of the same height, so the page does not shift when it
            resolves.

            Tokens briefly had a navbar chip here (the handoff asked for a
            persistent balance). Founder 2026-07-31 removed it: the rule this
            file always had — balance in the menu, hamburger alone on the right
            — applies to tokens too. Prices still appear on the triggers
            themselves, which is what "price before the action" actually
            needed; the running total did not have to be permanently on screen
            for that to work. */}
        <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 sm:gap-3">
          <AppMenu
            authState={menu.authState}
            userEmail={menu.userEmail}
            tokensLabel={menu.tokensLabel}
            lifeMenu={menu.lifeMenu}
            supportEmail={SUPPORT_EMAIL}
            communityUrl={COMMUNITY_URL}
            onLogout={menu.logout}
            loggingOut={menu.loggingOut}
            // Reachable from /panel/* too, which is where this header also
            // mounts — "Lab" is a real destination there, not a self-link.
            labHref="/chat"
            voiceAlbumHref="/voice-album"
            corpusHref={menu.isCoach ? "/coach/corpus" : null}
          />
        </div>
      </div>
    </header>
  );
}
