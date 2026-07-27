"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import PanelNotFound from "@/components/life/PanelNotFound";
import { useLifeState } from "@/lib/life/useLifeState";
import { panelMenu } from "@/lib/life/menu";
import { STATUS, VIEWS } from "@/lib/life/copy";
import { hasConsented, type LifeMenuEntry, type LifeState } from "@/lib/life/types";

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

/** FE-10 — the routes that ARE onboarding. They get the panel's chrome
 *  stripped: no nav pill row above the step header, no "Your data" link under
 *  it. One goal per screen means one thing on the screen, and a pill row that
 *  reads "Principles" over a heading that reads "Your three bets" is a second
 *  navigation offering itself mid-form. Everywhere else keeps both. */
const ONBOARDING_ROUTES = ["/panel/setup"];

function isOnboarding(pathname: string | null): boolean {
  return !!pathname && ONBOARDING_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

export default function PanelShell({ children }: { children: React.ReactNode }) {
  const { state, loading, refresh } = useLifeState();
  const pathname = usePathname();
  const onboarding = isOnboarding(pathname);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-background">
        <DashboardHeader />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">{STATUS.loading}</p>
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
      <div className="flex min-h-[100dvh] flex-col bg-background">
        <DashboardHeader />
        <PanelNotFound />
      </div>
    );
  }

  return (
    <LifeStateContext.Provider value={{ state, refresh }}>
      <div className="flex min-h-[100dvh] flex-col bg-background">
        <DashboardHeader />
        {/* Same derivation as the hamburger, so the two can never disagree
            about which views exist. */}
        {onboarding ? null : (
          <PanelNav menu={panelMenu(state)} pathname={pathname} />
        )}
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
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
}: {
  menu: LifeMenuEntry[];
  pathname: string | null;
}) {
  if (menu.length === 0) return null;
  return (
    <nav
      aria-label="Panel"
      className="sticky top-[73px] z-20 border-b border-border/70 bg-background/90 backdrop-blur"
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
