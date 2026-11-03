"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Coins, Home, Link as LinkIcon, LogOut, Menu, Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LifeMenuEntry } from "@/lib/life/types";
import { TOKENS_COPY } from "@/components/tokens/copy";
import type { ProductMenuEntry } from "@/lib/productDiscovery";

/* -------------------------------------------------------------------------- */
/*  AppMenu (FE-3) — ONE hamburger, mounted twice                              */
/*                                                                            */
/*  The lab's menu and the blog's menu were two different components with two  */
/*  different sets of entries, two stylings and two open/close behaviours. The */
/*  story asks for the same component on both, so this is it: one module, two  */
/*  mounts, NOT a copy. A copy is how they drifted apart the first time, and   */
/*  it is what would let them drift again the next time an entry is added.     */
/*                                                                            */
/*  Signed in (backend N367, 2026-11-03): you, Copy my link, Settings, Tokens, */
/*  Sign out, each with an iPhone-Settings icon; no Lab in the lab. Signed    */
/*  out (the blog): Lab, then Log in — the way into the product is never      */
/*  behind the sign-in.                                                        */
/*                                                                            */
/*  The host owns the DATA (auth state, email, token balance, panel entries,   */
/*  log out); this owns the CHROME. That split is what keeps the blog mount     */
/*  from having to know anything about pricing or the Life Panel gate.          */
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

/** The row of the page you are on keeps the hover look for good (founder
 *  2026-10-07: "when you are on the page show it orange text light orange
 *  background not only when you hover over it"). */
const MENU_ITEM_CURRENT_CLASS = "bg-accent text-accent-foreground";

/** Signed in, the menu as redesigned (backend N367, the "One bar" prototype,
 *  locked 2026-11-03): one row each, an iPhone-Settings-style icon on the
 *  left, rounded, no rules but the one above Sign out. */
const ROW_CLASS =
  "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-[15px] font-medium text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none";

const ICON_TONE = {
  blue: "bg-gradient-to-b from-[#3B8BFF] to-[#1F6FEB] text-white",
  grey: "bg-gradient-to-b from-[#A2A2A7] to-[#7C7C82] text-white",
  gold: "bg-gradient-to-b from-[#FFF1C2] to-[#FFE08A] text-[#7A4A00]",
  red: "bg-gradient-to-b from-[#FF6B66] to-[#E5484D] text-white",
  dark: "bg-foreground text-background",
} as const;

function MenuIcon({ tone, children }: { tone: keyof typeof ICON_TONE; children: React.ReactNode }) {
  return (
    <span aria-hidden className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]", ICON_TONE[tone])}>
      {children}
    </span>
  );
}

const MENU_ID = "app-header-menu";

export interface AppMenuProps {
  /** "unknown" renders the trigger but no menu body — the host is still
   *  resolving the session and a flash of the guest menu would be a lie. */
  authState: "unknown" | "anonymous" | "signed_in";
  /** Shown as the first row when signed in. Intake captures no name, so this
   *  is the linked-account email; hidden when unavailable. */
  userEmail?: string | null;
  /** Pre-formatted token balance for the menu row (e.g. "12,000 · 30 Aug"), or
   *  null when pricing is off / the balance is unreadable. A LABEL, not a
   *  number: the host owns the wallet read and the formatting, this owns the
   *  chrome — the split that keeps the blog mount ignorant of pricing. */
  tokensLabel?: string | null;
  /** Life Panel entries, straight from the gate payload. Absent for everyone
   *  the payload does not list them for, which is the normal case. */
  lifeMenu?: LifeMenuEntry[];
  /** Products introduced through a persisted, structured main-chat action. */
  productMenu?: ProductMenuEntry[];
  onLogout?: () => void;
  loggingOut?: boolean;
  /** Where "Lab" goes. The blog links into the product; the lab itself is
   *  already there, so its mount passes null and the row is omitted. */
  labHref?: string | null;
  /** The training-corpus workbench. COACH ONLY (N4): the host passes this
   *  only when the signed-in user is a coach, so the row does not exist for
   *  anyone else — not greyed out, not present. */
  corpusHref?: string | null;
  /** Signed-in privacy/consent management surface. */
  dataConsentHref?: string | null;
  /** The account's name, when it has one; the email is shown under it. */
  userName?: string | null;
  /** "Copy my link" (backend N308, N367): resolves to the full link to copy,
   *  or null. Passed only where the chats are on. */
  onCopyLink?: (() => Promise<string | null>) | null;
  /** The iPhone app: the Tokens row shows the balance and opens nothing
   *  (backend N365 item 1). */
  tokensOpenNothing?: boolean;
}

export default function AppMenu({
  authState,
  userEmail = null,
  tokensLabel = null,
  lifeMenu = [],
  productMenu = [],
  onLogout,
  loggingOut = false,
  labHref = null,
  corpusHref = null,
  dataConsentHref = null,
  userName = null,
  onCopyLink = null,
  tokensOpenNothing = false,
}: AppMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    const link = onCopyLink ? await onCopyLink() : null;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 900);
    } catch {
      // The clipboard is refused: nothing copied, nothing claimed.
    }
  };
  const pathname = usePathname();
  // An in-app row for the current page: marked, and announced as the page.
  const current = (href: string) =>
    pathname === href
      ? { className: cn(MENU_ITEM_CLASS, MENU_ITEM_CURRENT_CLASS), "aria-current": "page" as const }
      : { className: MENU_ITEM_CLASS };
  const row = (href: string) =>
    pathname === href
      ? { className: cn(ROW_CLASS, MENU_ITEM_CURRENT_CLASS), "aria-current": "page" as const }
      : { className: ROW_CLASS };
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
          if (e.key === "Enter" || e.key === " ")
            openByKeyboardRef.current = true;
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
          className="absolute right-0 top-full z-50 mt-2 w-[280px] rounded-2xl border bg-card p-2 shadow-lg"
        >
          {signedIn ? (
            <>
              {/* You first (backend N367 item 1): your circle, name and email.
                  Your profile (N366) opens from here once it is built. */}
              <div className="mb-1 flex items-center gap-3 border-b border-border px-2.5 pb-3 pt-2">
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#9FC1AE] text-[16px] font-semibold text-white"
                >
                  {(Array.from((userName || userEmail || "").trim())[0] ?? "").toUpperCase()}
                </span>
                <span className="min-w-0">
                  {userName ? <span className="block truncate text-[15px] font-semibold text-foreground">{userName}</span> : null}
                  {userEmail ? (
                    <span className="block truncate text-[12.5px] text-muted-foreground" title={userEmail}>
                      {userEmail}
                    </span>
                  ) : null}
                </span>
              </div>
              {labHref ? (
                <Link ref={firstRef()} href={labHref} {...row(labHref)} onClick={() => setOpen(false)}>
                  <MenuIcon tone="dark">
                    <Home className="h-[18px] w-[18px]" />
                  </MenuIcon>
                  <span className="flex-1">Lab</span>
                </Link>
              ) : null}
              {onCopyLink ? (
                <button type="button" className={ROW_CLASS} onClick={() => void copyLink()}>
                  <MenuIcon tone="blue">
                    <LinkIcon className="h-[18px] w-[18px]" />
                  </MenuIcon>
                  <span className="flex-1">
                    <span className="block">{copied ? "✓ Copied" : "Copy my link"}</span>
                    <span className="block text-[12.5px] font-normal text-muted-foreground">Whoever opens it joins you here</span>
                  </span>
                </button>
              ) : null}
              {dataConsentHref ? (
                <Link ref={firstRef()} href={dataConsentHref} {...row(dataConsentHref)} onClick={() => setOpen(false)}>
                  <MenuIcon tone="grey">
                    <Settings className="h-[18px] w-[18px]" />
                  </MenuIcon>
                  {/* The Data & consent page, called Settings (backend N196). */}
                  <span className="flex-1">Settings</span>
                </Link>
              ) : null}
              {tokensLabel ? (
                tokensOpenNothing ? (
                  // The iPhone app shows the balance and opens nothing: no
                  // link to buy in the app (backend N365 item 1, N367 item 2).
                  <div className={cn(ROW_CLASS, "cursor-default hover:bg-transparent")}>
                    <MenuIcon tone="gold">
                      <Coins className="h-[18px] w-[18px]" />
                    </MenuIcon>
                    <span className="flex-1">
                      <span className="block">{TOKENS_COPY.menuRowLabel}</span>
                      <span className="block text-[12.5px] font-normal text-muted-foreground">{tokensLabel}</span>
                    </span>
                  </div>
                ) : (
                  <Link ref={firstRef()} href="/dashboard/pricing" {...row("/dashboard/pricing")} onClick={() => setOpen(false)}>
                    <MenuIcon tone="gold">
                      <Coins className="h-[18px] w-[18px]" />
                    </MenuIcon>
                    <span className="flex-1">
                      <span className="block">{TOKENS_COPY.menuRowLabel}</span>
                      <span className="block text-[12.5px] font-normal text-muted-foreground">{tokensLabel}</span>
                    </span>
                  </Link>
                )
              ) : null}
              {/* Kept from before, for the few who have them: the coach's
                  corpus (N4), discovered products and the Life Panel's
                  server-sent entries. */}
              {corpusHref ? (
                <Link ref={firstRef()} href={corpusHref} {...row(corpusHref)} onClick={() => setOpen(false)}>
                  <MenuIcon tone="grey">
                    <BookOpen className="h-[18px] w-[18px]" />
                  </MenuIcon>
                  <span className="flex-1">Training corpus</span>
                </Link>
              ) : null}
              {productMenu.map((entry) => (
                <Link key={entry.product} ref={firstRef()} href={entry.href} {...row(entry.href)} onClick={() => setOpen(false)}>
                  <MenuIcon tone="grey">
                    <Sparkles className="h-[18px] w-[18px]" />
                  </MenuIcon>
                  <span className="flex-1">{entry.label}</span>
                </Link>
              ))}
              {lifeMenu.map((entry) =>
                entry.external ? (
                  <a key={entry.key} ref={firstRef()} href={entry.href} rel="noopener" className={ROW_CLASS} onClick={() => setOpen(false)}>
                    <MenuIcon tone="grey">
                      <Sparkles className="h-[18px] w-[18px]" />
                    </MenuIcon>
                    <span className="flex-1">{entry.label}</span>
                  </a>
                ) : (
                  <Link key={entry.key} ref={firstRef()} href={entry.href} {...row(entry.href)} onClick={() => setOpen(false)}>
                    <MenuIcon tone="grey">
                      <Sparkles className="h-[18px] w-[18px]" />
                    </MenuIcon>
                    <span className="flex-1">{entry.label}</span>
                  </Link>
                ),
              )}
              <div className="mx-1.5 my-1 h-px bg-border" />
              <button
                type="button"
                onClick={onLogout}
                disabled={loggingOut}
                className={cn(ROW_CLASS, "text-[#B42318] disabled:opacity-50")}
              >
                <MenuIcon tone="red">
                  <LogOut className="h-[18px] w-[18px]" />
                </MenuIcon>
                <span className="flex-1">{loggingOut ? "Signing out…" : "Sign out"}</span>
              </button>
            </>
          ) : (
            <>
              {/* Signed out (the blog): Lab first, the way into the product
                  never gated; then Log in. */}
              {labHref ? (
                <Link ref={firstRef()} href={labHref} {...current(labHref)} onClick={() => setOpen(false)}>
                  Lab
                </Link>
              ) : null}
              <Link href="/login" className={MENU_ITEM_CLASS} onClick={() => setOpen(false)}>
                Log in
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
