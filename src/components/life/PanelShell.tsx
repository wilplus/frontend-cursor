"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import PanelNotFound from "@/components/life/PanelNotFound";
import LoadingState from "@/components/willab/LoadingState";
import { useLifeState } from "@/lib/life/useLifeState";
import { panelMenu } from "@/lib/life/menu";
import { SCREEN_BOTTOM_GAP } from "@/lib/screenChrome";
import { VIEWS } from "@/lib/life/copy";
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
/*  The app header is reused rather than rebuilt so the panel is visibly the   */
/*  same product, same session, one deploy (spec §1.1).                        */
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
 *  Onboarding gets the panel's chrome stripped: no nav pill row above the step
 *  header, no "Your data" link under it. One goal per screen means one thing on
 *  the screen, and a pill row reading "Principles" over a heading reading "Your
 *  three bets" is a second navigation offering itself mid-form.
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

/** Founder 2026-07-30 — the Principles page carries NO app header.
 *
 *  The logo-and-hamburger bar comes off this one route entirely: the guide, the
 *  consent screen, the ten setup steps and the results all render without it.
 *  It is the same argument that already strips the pill row and the "Your data"
 *  link during onboarding — this is the entrance, and an entrance offering a
 *  menu is offering a way back out — extended to the route rather than to the
 *  state, because that is what was asked for.
 *
 *  Deliberately a path check and not a state check, unlike `isOnboarding`: the
 *  condition here is "which page", not "how far through the gate", so it must
 *  hold on the loading and the 404 branch too. A header that renders for the
 *  duration of the state fetch and then vanishes is a layout jump, not chrome.
 *
 *  Scoped to the index. `/panel/principles/[id]` is a leaf the user arrives at
 *  from a list, and it keeps the header it needs to get back. */
function hidesAppHeader(pathname: string | null): boolean {
  return pathname === "/panel/principles";
}

export default function PanelShell({ children }: { children: React.ReactNode }) {
  const { state, loading, refresh } = useLifeState();
  const pathname = usePathname();
  const onboarding = state ? isOnboarding(state, pathname) : false;
  const bare = hidesAppHeader(pathname);

  if (loading) {
    return (
      <div className="flex min-h-full flex-col bg-background">
        {bare ? null : <DashboardHeader />}
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
        {bare ? null : <DashboardHeader />}
        {/* PanelNotFound carries its own way out ("Back to the lab"), so the
            dead end is never a dead end even with the header gone. */}
        <PanelNotFound />
      </div>
    );
  }

  return (
    <LifeStateContext.Provider value={{ state, refresh }}>
      <div className="flex min-h-full flex-col bg-background">
        {bare ? null : <DashboardHeader />}
        {/* Same derivation as the hamburger, so the two can never disagree
            about which views exist. */}
        {onboarding ? null : (
          <PanelNav
            menu={panelMenu(state)}
            pathname={pathname}
            headerAbove={!bare}
          />
        )}
        {/* A flex COLUMN, not a plain block: the setup flow pins its Back/Next
            bar to the bottom with `mt-auto`, which needs its own height to
            come from this column rather than from its content. Stacked
            content in every other view renders identically either way. */}
        <main
          className={`mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pt-8 ${SCREEN_BOTTOM_GAP}`}
        >
          {children}
        </main>
        {/* FE-10 — export and hard delete stay two clicks away for anyone who
            has written anything, rather than being buried in account settings.
            Not a gated menu entry: a person with data must always be able to
            take it out or erase it. */}
        {/* FE-10 — not during onboarding. Export and hard delete stay two
            clicks away for anyone who has WRITTEN anything, which is the point
            of the link; a user still filling in the form has not written
            anything yet, and the link is one more thing on a screen that is
            meant to hold one. It returns the moment they are through. */}
        {hasConsented(state) && !onboarding ? (
          <footer className="mx-auto w-full max-w-3xl px-5 pb-10">
            <Link
              href="/panel/data"
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {VIEWS.data.title}
            </Link>
          </footer>
        ) : null}
      </div>
    </LifeStateContext.Provider>
  );
}

function PanelNav({
  menu,
  pathname,
  headerAbove,
}: {
  menu: LifeMenuEntry[];
  pathname: string | null;
  /** Whether DashboardHeader is mounted above this row. 73px is that header's
   *  height, and it is what this row sticks BELOW so the two do not overlap
   *  when the page scrolls. With no header there is nothing to clear, and the
   *  offset would show as a 73px band of page scrolling past above the pills. */
  headerAbove: boolean;
}) {
  if (menu.length === 0) return null;
  return (
    <nav
      aria-label="Panel"
      className={`sticky z-20 border-b border-border/70 bg-background/90 backdrop-blur ${
        headerAbove ? "top-[73px]" : "top-0"
      }`}
    >
      <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 py-2">
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
    </nav>
  );
}
