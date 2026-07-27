"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LifeMenuEntry } from "@/lib/life/types";

/* -------------------------------------------------------------------------- */
/*  AppMenu (FE-3) — ONE hamburger, mounted twice                              */
/*                                                                            */
/*  The lab's menu and the blog's menu were two different components with two  */
/*  different sets of entries, two stylings and two open/close behaviours. The */
/*  story asks for the same component on both, so this is it: one module, two  */
/*  mounts, NOT a copy. A copy is how they drifted apart the first time, and   */
/*  it is what would let them drift again the next time an entry is added.     */
/*                                                                            */
/*  "Lab" sits at the TOP, separated from the rest by a light 1px stroke, on   */
/*  both mounts. Signed out (the usual case on the blog): no email row, no     */
/*  credits row, Lab still first — the way into the product is never behind    */
/*  the sign-in.                                                               */
/*                                                                            */
/*  The host owns the DATA (auth state, email, credits, panel entries, log     */
/*  out); this owns the CHROME. That split is what keeps the blog mount from   */
/*  having to know anything about credits or the Life Panel gate.              */
/* -------------------------------------------------------------------------- */

/** Shared item styling, so every row reads identically on both mounts.
 *
 *  Founder 2026-07-27 — ONE font and ONE row height for every entry, with no
 *  rules between them. The menu used to be three bordered groups (Lab, the
 *  panel entries, then the account rows), which read as three menus stacked
 *  rather than one list. The only survivor is the email at the very top: it is
 *  not an entry, it is whose account this is, so it keeps its divider. Rows
 *  are py-3.5 — a taller target, and the extra air is what separates them now
 *  that no stroke does. */
export const MENU_ITEM_CLASS =
  "block w-full px-4 py-3.5 text-left font-semibold text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none";

const MENU_ID = "app-header-menu";

export interface AppMenuProps {
  /** "unknown" renders the trigger but no menu body — the host is still
   *  resolving the session and a flash of the guest menu would be a lie. */
  authState: "unknown" | "anonymous" | "signed_in";
  /** Shown as the first row when signed in. Intake captures no name, so this
   *  is the linked-account email; hidden when unavailable. */
  userEmail?: string | null;
  /** Credits → checkout. null hides the row (guests, or not yet loaded). */
  credits?: number | null;
  /** Life Panel entries, straight from the gate payload. Absent for everyone
   *  the payload does not list them for, which is the normal case. */
  lifeMenu?: LifeMenuEntry[];
  /** Support mailto target. */
  supportEmail: string;
  /** The Skool community. Off-site, so a new tab. */
  communityUrl: string;
  onLogout?: () => void;
  loggingOut?: boolean;
  /** Where "Lab" goes. The blog links into the product; the lab itself is
   *  already there, so its mount passes null and the row is omitted. */
  labHref?: string | null;
  /** Where the confidence game lives (founder 2026-07-28: "the game should
   *  live in the hamburger"). Signed-in only — the game plays the user's own
   *  coach-confirmed moments, which a guest does not have. */
  gameHref?: string | null;
}

export default function AppMenu({
  authState,
  userEmail = null,
  credits = null,
  lifeMenu = [],
  supportEmail,
  communityUrl,
  onLogout,
  loggingOut = false,
  labHref = null,
  gameHref = null,
}: AppMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const openByKeyboardRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      if (buttonRef.current && document.contains(buttonRef.current)) {
        buttonRef.current.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (open && openByKeyboardRef.current && firstLinkRef.current) {
      const t = requestAnimationFrame(() => {
        firstLinkRef.current?.focus();
        openByKeyboardRef.current = false;
      });
      return () => cancelAnimationFrame(t);
    }
  }, [open]);

  if (authState === "unknown") return <div className="h-10" aria-hidden />;

  const signedIn = authState === "signed_in";
  // Lab is first, so it takes the keyboard-open focus whenever it is drawn.
  let claimedFirst = false;
  const firstRef = () => {
    if (claimedFirst) return undefined;
    claimedFirst = true;
    return firstLinkRef;
  };

  return (
    <div className="relative flex shrink-0" ref={menuRef}>
      <Button
        ref={buttonRef}
        variant="outline"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") openByKeyboardRef.current = true;
        }}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={open ? MENU_ID : undefined}
        className="h-10 w-10"
      >
        <Menu className="h-5 w-5" />
      </Button>
      {open && (
        <div
          id={MENU_ID}
          className="absolute right-0 top-full z-50 mt-2 w-64 min-w-[14rem] rounded-lg border bg-card py-2 shadow-lg"
        >
          {/* The email first, and the ONLY divider in the menu: it names the
              account rather than offering an action, so it is the one thing
              that is not part of the list. */}
          {signedIn && userEmail ? (
            <div
              className="mb-1 truncate border-b border-border px-4 py-2.5 text-[13px] text-muted-foreground"
              title={userEmail}
            >
              {userEmail}
            </div>
          ) : null}

          {/* Lab leads the entries. Drawn signed in AND signed out — the way
              into the product is never gated. */}
          {labHref ? (
            <Link
              ref={firstRef()}
              href={labHref}
              className={MENU_ITEM_CLASS}
              onClick={() => setOpen(false)}
            >
              Lab
            </Link>
          ) : null}

          {signedIn && gameHref ? (
            <Link
              ref={firstRef()}
              href={gameHref}
              className={MENU_ITEM_CLASS}
              onClick={() => setOpen(false)}
            >
              Confidence game
            </Link>
          ) : null}

          {signedIn && lifeMenu.length > 0 ? (
            <>
              {lifeMenu.map((entry) =>
                entry.external ? (
                  // Prayer lives on its own subdomain: separate service worker
                  // scope, separate PWA install, works signed out and offline.
                  <a
                    key={entry.key}
                    ref={firstRef()}
                    href={entry.href}
                    rel="noopener"
                    className={MENU_ITEM_CLASS}
                    onClick={() => setOpen(false)}
                  >
                    {entry.label}
                  </a>
                ) : (
                  <Link
                    key={entry.key}
                    ref={firstRef()}
                    href={entry.href}
                    className={MENU_ITEM_CLASS}
                    onClick={() => setOpen(false)}
                  >
                    {entry.label}
                  </Link>
                )
              )}
            </>
          ) : null}

          <a
            ref={firstRef()}
            href={`mailto:${supportEmail}`}
            className={MENU_ITEM_CLASS}
            onClick={() => setOpen(false)}
          >
            Support
          </a>

          <a
            href={communityUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={MENU_ITEM_CLASS}
            onClick={() => setOpen(false)}
          >
            Community
          </a>

          {signedIn && credits !== null ? (
            <Link
              href="/dashboard/pricing"
              className={cn(MENU_ITEM_CLASS, "flex items-center justify-between")}
              onClick={() => setOpen(false)}
            >
              <span>Credits</span>
              <span className="flex items-center gap-1 font-normal text-muted-foreground">
                <span className="text-base leading-none">🎓</span>
                {credits}
              </span>
            </Link>
          ) : null}

          {signedIn ? (
            <button
              type="button"
              onClick={onLogout}
              disabled={loggingOut}
              className={cn(MENU_ITEM_CLASS, "disabled:opacity-50")}
            >
              {loggingOut ? "Logging out…" : "Log out"}
            </button>
          ) : (
            <Link
              href="/login"
              className={MENU_ITEM_CLASS}
              onClick={() => setOpen(false)}
            >
              Log in
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
