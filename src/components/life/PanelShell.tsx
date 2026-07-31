"use client";

import { createContext, useCallback, useContext, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import PanelNotFound from "@/components/life/PanelNotFound";
import PanelUpload from "@/components/life/PanelUpload";
import LoadingState from "@/components/willab/LoadingState";
import { useLifeState } from "@/lib/life/useLifeState";
import { panelMenu } from "@/lib/life/menu";
import { SCREEN_BOTTOM_GAP } from "@/lib/screenChrome";
import { PANEL } from "@/lib/life/copy";
import {
  hasConsented,
  principlesTabView,
  type LifeMenuEntry,
  type LifeState,
} from "@/lib/life/types";

/* -------------------------------------------------------------------------- */
/*  PanelShell — chrome and gate for every /panel/* view (FE-1)                */
/*                                                                            */
/*  N1, ABSENT NOT DISABLED, is enforced in two places here:                   */
/*    · the nav renders `state.menu` and nothing else. There is no local list  */
/*      of views to fall back to, so a surface the payload omits cannot appear */
/*      even by accident, and there is no greyed "coming soon" to explain.     */
/*    · no state at all (flag off, or this user is on no allowlist) → 404.     */
/*      Not a message, not an empty shell. Nothing to discover.                */
/*                                                                            */
/*  THE APP HEADER IS GONE FROM THE WHOLE PANEL (founder 2026-07-31). It came  */
/*  off the Principles route first, on the argument that an entrance offering  */
/*  a menu is offering a way back out; that argument was never specific to     */
/*  Principles. The panel is the one surface in the product a person is        */
/*  supposed to sit inside, and the logo, the wallet chip and the hamburger    */
/*  were three ways out stacked above a row that already navigates.            */
/*                                                                            */
/*  So the pill row is now the panel's ONLY chrome, and it carries the one     */
/*  exit itself: the X at its right end. That is deliberate rather than        */
/*  minimal. A surface with no header and no X is a trap, and the way out has  */
/*  to be somewhere a thumb already is.                                       */
/*                                                                            */
/*  Under every view is the document dock (`PanelUpload`), which is the same   */
/*  upload setup opens with, on every screen instead of one.                   */
/* -------------------------------------------------------------------------- */

interface LifePanelContextValue {
  state: LifeState;
  /** Re-read the gate. Called after consent and after setup completes, because
   *  both change which of the Principles tab's three jobs is current. */
  refresh: () => Promise<LifeState | null>;
}

const LifeStateContext = createContext<LifePanelContextValue | null>(null);

/** The gate payload for the current view. Only ever called under PanelShell,
 *  which does not render children until the state is loaded and non-null. */
export function useLifePanel(): LifePanelContextValue {
  const ctx = useContext(LifeStateContext);
  if (!ctx) {
    throw new Error("useLifePanel must be used inside PanelShell");
  }
  return ctx;
}

/** FE-10 — is the user looking at ONBOARDING right now?
 *
 *  Onboarding gets what chrome is left stripped: no nav pill row above the
 *  step header, and no document dock beneath it. One goal per screen means one
 *  thing on the screen, and a pill row reading "Principles" over a heading
 *  reading "Your three bets" is a second navigation offering itself mid-form.
 *  Setup carries its own way out and its own document step, so it loses
 *  nothing by losing both.
 *
 *  This asks the STATE, not the path. It used to be a route allowlist holding
 *  only "/panel/setup", which missed the setup flow's OTHER mount: the
 *  Principles tab renders SetupFlow itself whenever consent is given and setup
 *  is unfinished (principlesTabView → "setup"). That is the mount most users
 *  actually meet — it is where the resume lands — so the allowlist stripped the
 *  chrome from the route almost nobody onboards on and left it on the one they
 *  do. Consent and completion are the real condition, and they are the same on
 *  every route. */
function isOnboarding(state: LifeState, pathname: string | null): boolean {
  if (pathname === "/panel/setup") return true;
  // The Principles tab IS the setup form until setup is finished.
  return (
    pathname === "/panel/principles" && principlesTabView(state) !== "results"
  );
}

export default function PanelShell({ children }: { children: React.ReactNode }) {
  const { state, loading, refresh } = useLifeState();
  const pathname = usePathname();
  const onboarding = state ? isOnboarding(state, pathname) : false;

  /* Rows created from the dock are the surrounding view's own content, and the
   * views hold their reads in their own hooks, out of reach from here. Bumping
   * this remounts the view, which refetches it. A remount rather than a
   * plumbed-through reload because it is one line and it cannot miss a view:
   * the next screen someone docks an upload under gets it for free. */
  const [contentNonce, setContentNonce] = useState(0);
  const reloadContent = useCallback(() => setContentNonce((n) => n + 1), []);

  if (loading) {
    return (
      <div className="flex min-h-full flex-col bg-background">
        <div className="flex flex-1 items-center justify-center">
          <LoadingState withTip={false} />
        </div>
      </div>
    );
  }

  // Rendered inline rather than through `notFound()`. This component IS the
  // panel layout, so throwing NEXT_NOT_FOUND from here would be caught by
  // whichever boundary happens to sit above the layout, and if that boundary
  // renders `panel/not-found.tsx` back INSIDE this layout the shell re-enters
  // and throws again. The user-visible result is identical either way, and
  // this way it does not depend on where Next places the boundary.
  if (!state) {
    return (
      <div className="flex min-h-full flex-col bg-background">
        {/* PanelNotFound carries its own way out ("Back to the lab"), so the
            dead end is never a dead end with no header above it. */}
        <PanelNotFound />
      </div>
    );
  }

  return (
    <LifeStateContext.Provider value={{ state, refresh }}>
      <div className="flex min-h-full flex-col bg-background">
        {/* Same derivation as the hamburger, so the two can never disagree
            about which views exist. */}
        {onboarding ? null : (
          <PanelNav menu={panelMenu(state)} pathname={pathname} />
        )}
        {/* A flex COLUMN, not a plain block: the setup flow pins its Back/Next
            bar to the bottom with `mt-auto`, which needs its own height to
            come from this column rather than from its content. Stacked
            content in every other view renders identically either way.
            No page heading sits above this any more, so the top padding is
            the whole of the gap between the pill row and the first row of
            content. */}
        <main
          key={contentNonce}
          className={`mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pt-6 ${SCREEN_BOTTOM_GAP}`}
        >
          {children}
        </main>
        {/* FE-10's standing "Your data" link is gone from here (founder
            2026-07-31). `/panel/data` still serves the export and the hard
            delete, unchanged, and the consent screen still promises both:
            what changed is that this footer is no longer the thing carrying
            the promise, so the link has to be re-hung somewhere before that
            copy is true again. Flagged, not silently dropped. */}
        {hasConsented(state) && !onboarding ? (
          <PanelUpload onApplied={reloadContent} />
        ) : null}
      </div>
    </LifeStateContext.Provider>
  );
}

function PanelNav({
  menu,
  pathname,
}: {
  menu: LifeMenuEntry[];
  pathname: string | null;
}) {
  if (menu.length === 0) return null;
  return (
    <nav
      aria-label="Panel"
      className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2">
        {/* The scrolling strip is shortened by exactly the X, rather than
            scrolling under it: a pill half-hidden behind a button reads as a
            rendering fault, and the last pill is the one people reach for. */}
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {menu.map((entry) => {
            const active =
              !entry.external &&
              pathname != null &&
              (pathname === entry.href || pathname.startsWith(`${entry.href}/`));
            const className = `whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition-colors ${
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`;
            // Prayer leaves the app entirely: its own subdomain, its own service
            // worker scope, its own PWA install (spec §3.4).
            return entry.external ? (
              <a
                key={entry.key}
                href={entry.href}
                className={className}
                rel="noopener"
              >
                {entry.label}
              </a>
            ) : (
              <Link key={entry.key} href={entry.href} className={className}>
                {entry.label}
              </Link>
            );
          })}
        </div>

        {/* The panel's only exit, now that the header carrying the logo is
            off every one of these screens. It lands where the 404's own way
            out lands, so leaving the panel means one place, not two. */}
        <Link
          href="/chat"
          aria-label={PANEL.closeLabel}
          title={PANEL.closeLabel}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
