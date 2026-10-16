"use client";

import { Button } from "@/components/ui/button";
import { VoiceMark } from "./LoadingState";
import { READY_SIGN_UP_COPY } from "./GuestSignUpDialog";

/* -------------------------------------------------------------------------- */
/*  ReadySignUpScreen — "the processing is done" (founder 2026-10-16)          */
/*                                                                            */
/*  A guest's Take has been processed. Instead of the readout they see this    */
/*  one screen: the ready line the Lounge posts, the ask, and the same two     */
/*  answers the sign-up dialog gives. "Create an account" parks the text and   */
/*  goes to /signup (the Take is claimed after); "Not now" goes back to the    */
/*  chat, where the recording bubble brings them back HERE, never to the       */
/*  text. Nothing on it is a number or a verdict.                             */
/*                                                                            */
/*  Drawn like the wait screen it follows (the mark, one column, the pill),   */
/*  so processing → ready reads as one screen changing its line.              */
/* -------------------------------------------------------------------------- */

export default function ReadySignUpScreen({
  onSignUp,
  onNotNow,
}: {
  onSignUp: () => void;
  /** The host's way out (the Lab parks the text; the Lounge closes). Absent,
   *  as for a host with its own exit, the link is not drawn. */
  onNotNow?: () => void;
}) {
  return (
    <div
      data-ready-sign-up
      className="fixed inset-0 z-40 flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ready-sign-up-title"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-16 text-center">
        <VoiceMark size={64} />
        <div className="flex flex-col gap-2">
          <h1
            id="ready-sign-up-title"
            className="text-[24px] font-semibold leading-tight tracking-tight text-foreground"
          >
            {READY_SIGN_UP_COPY.title}
          </h1>
          <p className="max-w-xs text-[15px] leading-relaxed text-muted-foreground">
            {READY_SIGN_UP_COPY.body}
          </p>
        </div>
        <div className="mt-2 flex w-full max-w-xs flex-col items-center gap-3">
          <Button
            type="button"
            onClick={onSignUp}
            className="h-12 w-full rounded-full bg-foreground text-[15px] font-medium text-background hover:bg-foreground/90"
          >
            {READY_SIGN_UP_COPY.primary}
          </Button>
          {onNotNow ? (
            <button
              type="button"
              onClick={onNotNow}
              className="min-h-[44px] px-4 text-[14px] font-medium text-muted-foreground underline underline-offset-4"
            >
              {READY_SIGN_UP_COPY.secondary}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
