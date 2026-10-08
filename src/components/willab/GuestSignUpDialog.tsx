"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import { readGuestOwnerToken } from "@/services/api/projects";

/** A guest reads the whole page and is asked to sign up at the step that
 *  needs an account (founder 2026-10-04, F1 Repair Plan Phase 0.6):
 *
 *    "You need to show the full feedback ... and then when they click on the
 *     text, the bookmark should open, the feedback should open. And then when
 *     they want to practice, then show you need to sign up. That should be
 *     the order."
 *
 *  So nothing opens by itself. Reading is free: the text, the slides, the
 *  bars, the paragraph sheet and its history. The steps that keep or change
 *  something -- practise, Record Take 2, locking helper words, editing,
 *  deciding a suggestion -- open this dialog instead, because each of them
 *  writes to an account the guest does not have yet. "Not now" returns to
 *  the page exactly as it was.
 *
 *  `useGuestGate` is the one switch: an account gets every callback back
 *  untouched; a guest gets each one replaced by "ask, and refuse". */

export const GUEST_SIGN_UP_COPY = {
  title: "Create an account to continue",
  body: "Practising, recording Take 2 and keeping your changes need an account. Your recording comes with you.",
  primary: "Create an account",
  secondary: "Not now",
} as const;

export default function GuestSignUpDialog({
  open,
  onSignUp,
  onClose,
}: {
  open: boolean;
  onSignUp: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      // Above the Feedback and paragraph sheets (z-50): practise is asked
      // from inside them.
      className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/35 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-sign-up-title"
    >
      <div className="w-full max-w-sm rounded-3xl bg-background p-5 shadow-xl">
        <h2
          id="guest-sign-up-title"
          className="text-[18px] font-semibold text-foreground"
        >
          {GUEST_SIGN_UP_COPY.title}
        </h2>
        <p className="mt-2 text-[14px] text-muted-foreground">
          {GUEST_SIGN_UP_COPY.body}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            type="button"
            onClick={onSignUp}
            className="h-12 w-full rounded-full bg-foreground text-[15px] font-medium text-background hover:bg-foreground/90"
          >
            {GUEST_SIGN_UP_COPY.primary}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-12 w-full rounded-full text-[15px] font-medium"
          >
            {GUEST_SIGN_UP_COPY.secondary}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The page's guest gate, for steps asked deep inside the sheets (practise).
 *  Provided by IdealTextReadout only; an account's page has none. */
export const GuestGateContext = createContext<(() => boolean) | null>(null);
const NEVER_BLOCKED = () => false;

/** `block()`: true -- and the sign-up dialog opens -- when the reader is a
 *  guest, so the caller stops; false for an account, which goes on. */
export function useGuestBlock(): () => boolean {
  return useContext(GuestGateContext) ?? NEVER_BLOCKED;
}

export interface GuestGate {
  /** A signed-out reader holding the guest identity for this project. */
  guest: boolean;
  /** The page may be read: an account, or this project's guest. */
  canRead: boolean;
  /** The plain fallback's own sign-up button shows: signed out and no page
   *  could be read. */
  plainSignUp: (pageLoaded: boolean) => boolean;
  /** `fn` for a guest, undefined for an account: a step only a guest takes. */
  forGuest: <F>(fn: F) => F | undefined;
  /** Open the dialog. */
  ask: () => void;
  /** For `GuestGateContext`: open the dialog and answer true for a guest. */
  block: () => boolean;
  /** An account gets `fn` back; a guest gets "open the dialog, answer
   *  `refused`" -- the step never reaches a route that needs an account. */
  gate: <A extends unknown[], R>(fn: (...args: A) => R, refused: R) => (...args: A) => R;
  /** The dialog itself, rendered once by the host (null for an account). */
  dialog: React.ReactNode;
}

export function useGuestGate({
  signedIn,
  arcId,
  onSignUp,
}: {
  signedIn: boolean | null;
  arcId: string | null;
  onSignUp: () => void;
}): GuestGate {
  const guest = signedIn === false && !!arcId && !!readGuestOwnerToken();
  const [open, setOpen] = useState(false);
  const ask = useCallback(() => {
    setOpen(true);
  }, []);
  const block = useCallback(() => {
    if (!guest) return false;
    ask();
    return true;
  }, [guest, ask]);
  const gate = useCallback(
    <A extends unknown[], R>(fn: (...args: A) => R, refused: R) =>
      guest
        ? (..._args: A): R => {
            ask();
            return refused;
          }
        : fn,
    [guest, ask],
  );
  const dialog = guest ? (
    <GuestSignUpDialog
      open={open}
      onSignUp={onSignUp}
      onClose={() => setOpen(false)}
    />
  ) : null;
  const canRead = signedIn === true || guest;
  const plainSignUp = (pageLoaded: boolean) =>
    signedIn === false && !pageLoaded;
  const forGuest = <F,>(fn: F): F | undefined => (guest ? fn : undefined);
  return { guest, canRead, plainSignUp, forGuest, ask, block, gate, dialog };
}
