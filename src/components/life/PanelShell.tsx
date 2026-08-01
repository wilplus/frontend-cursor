"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings2, X } from "lucide-react";
import PanelNotFound from "@/components/life/PanelNotFound";
import PanelUpload from "@/components/life/PanelUpload";
import LoadingState from "@/components/willab/LoadingState";
import { useLifeState } from "@/lib/life/useLifeState";
import { panelChrome, panelMenu } from "@/lib/life/menu";
import { warmPanelView } from "@/lib/life/prefetch";
import { SCREEN_BOTTOM_GAP } from "@/lib/screenChrome";
import { PANEL, VIEWS } from "@/lib/life/copy";
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
/*                                                                            */
/*  THE WAY TO YOUR DATA RIDES THE SAME ROW, left of the X. It was a standing  */
/*  link in a footer until the chrome pass took the footer with everything     */
/*  else, and it has to be SOMEWHERE: the consent screen promises export and   */
/*  hard delete "live in the panel, two clicks away, not buried in settings",  */
/*  and a promise with nothing behind it is the worst of the three states.     */
/*                                                                            */
/*  It is NOT a menu entry, and that is the whole point of putting it here     */
/*  rather than in `LIFE_VIEWS`. `panelMenu` hands back `state.menu` wholesale */
/*  whenever the server sends one, so a data entry added to the derived list   */
/*  would silently vanish for exactly the allowlisted users the server         */
/*  enumerates — the promise would hold for most people and quietly break for  */
/*  some. A person with data must always be able to take it out or erase it,   */
/*  so this link is gated on consent and on nothing else.                      */
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
  // The three answers live in lib/life/menu so they are testable without
  // rendering: the bug this replaced was a chrome decision, and it silently
  // removed the only route to the hard delete.
  const chrome = panelChrome(state, onboarding);

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
        {/* Consent, not participation: someone who has written anything can
            always reach the export and the delete.

            ONBOARDING KEEPS THE DATA CONTROL (founder 2026-08-01). This used
            to render nothing at all during setup, reasoning that "a user still
            filling in the form has written nothing yet". That was not true: by
            the second step they have consented, saved answers on every step —
            the form itself says "Saved. You can close this and come back to
            it" — and may have uploaded documents.

            It also closed the LAST door to /panel/data. The Principles tab IS
            the form until setup finishes, the pre-setup menu is Principles
            alone, and the gear that links to the data screen lived in exactly
            the chrome this branch removed. So a person half-way through setup
            could not erase it without typing the URL by hand, while the
            consent screen went on promising the export and the delete were two
            clicks away. This is the re-hang the note under <main> asks for.

            THE VIEWS STILL DO NOT RENDER: an empty menu means no pill row, so
            the "one thing on the screen" rule that stripped this chrome
            originally is intact. Only the way to the data survives — and not
            the X, because the wizard carries its own and two close controls on
            one screen is worse than none. */}
        <PanelNav
          menu={chrome.showViews ? panelMenu(state) : []}
          pathname={pathname}
          showData={chrome.showData}
          showExit={chrome.showExit}
        />
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
  showData,
  showExit = true,
}: {
  menu: LifeMenuEntry[];
  pathname: string | null;
  /** Whether to offer the way to export and hard delete. Deliberately a plain
   *  boolean and not a menu entry — see the note at the top of this file. */
  showData: boolean;
  /** False during setup, where the wizard renders its own close control. Two
   *  X buttons on one screen is worse than none: they look like a mistake, and
   *  the user has to guess which one abandons what. */
  showExit?: boolean;
}) {
  const stripRef = useRef<HTMLDivElement | null>(null);

  /* `inline: "nearest"` so a pill already fully visible does not move: the row
   * must not slide on every navigation, only when the pill just landed on
   * would otherwise be clipped. `block: "nearest"` keeps it horizontal —
   * without it the browser scrolls the PAGE to bring the row into view, which
   * on a long view yanks the reader back to the top for no reason. */
  useEffect(() => {
    stripRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [pathname]);

  // An empty menu is no longer the same thing as nothing to render: during
  // setup the views are deliberately withheld while the data control is not.
  // Only when there is genuinely nothing left does the bar disappear.
  if (menu.length === 0 && !showData && !showExit) return null;
  return (
    <nav
      aria-label="Panel"
      className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2">
        {/* The scrolling strip is shortened by exactly the controls beside it,
            rather than scrolling under them: a pill half-hidden behind a button
            reads as a rendering fault.
            
            AND THE ACTIVE PILL IS SCROLLED INTO VIEW, which is the other half
            of that. This strip has always been narrower than its contents on a
            phone, so on any given screen SOME pill is cut by the right edge —
            that is what a scrolling row is. Adding the data control narrowed it
            again and made the cut land one pill earlier. Fine for a pill you
            are not on; wrong for the one you are, because an active black pill
            sliced flat reads as a broken render rather than as "scroll for
            more". */}
        <div ref={stripRef} className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
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
              <Link
                key={entry.key}
                href={entry.href}
                className={className}
                data-active={active || undefined}
                /* Start the view's read before the tap lands. Next already
                   prefetches the route's JS; this is the DATA half, which is
                   what the spinner was actually waiting for. Touch-start
                   rather than click because it fires first. */
                onPointerEnter={() => warmPanelView(entry.href)}
                onTouchStart={() => warmPanelView(entry.href)}
              >
                {entry.label}
              </Link>
            );
          })}
        </div>

        {/* Two controls, in the order they are reached for. Neither is a pill:
            the strip above holds the views, and these are what you do to the
            panel rather than places inside it. */}
        {showData ? (
          <Link
            href="/panel/data"
            aria-label={VIEWS.data.title}
            title={VIEWS.data.title}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted hover:text-foreground ${
              pathname === "/panel/data"
                ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                : "text-muted-foreground"
            }`}
          >
            <Settings2 className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}

        {/* The panel's only exit, now that the header carrying the logo is
            off every one of these screens. It lands where the 404's own way
            out lands, so leaving the panel means one place, not two. Last on
            the row because a close control that is not at the end is a close
            control people miss. */}
        {showExit ? (
          <Link
            href="/chat"
            aria-label={PANEL.closeLabel}
            title={PANEL.closeLabel}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
