"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { VoiceMark } from "./LoadingState";
import { READY_SIGN_UP_COPY } from "./GuestSignUpDialog";
import { CHUNK_SHEET_COPY as COPY } from "./idealEditCopy";
import WalkPlayer from "./walk/WalkPlayer";
import WalkMessage from "./walk/WalkMessage";
import type { WallMoment } from "./wallMoment";

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
/*                                                                            */
/*  ONE PIECE OF THE RESULT (founder 2026-10-29, backend N273 item 5;         */
/*  prototype https://claude.ai/artifact/LyE1Xa7M5D2FWXDxFzPKtT): between    */
/*  the line and the buttons, the clip of the Take's most confident moment   */
/*  as the walk draws it (the orange bubble on the right) and the walk's own  */
/*  "This was your most confident moment." in the grey bubble under it. No   */
/*  moment, or a clip that will not play: the screen is as it was.          */
/* -------------------------------------------------------------------------- */

export default function ReadySignUpScreen({
  onSignUp,
  onNotNow,
  moment = null,
}: {
  onSignUp: () => void;
  /** The Take's most confident moment and its clip (wallMoment.ts). */
  moment?: WallMoment | null;
  /** The host's way out (the Lab parks the text; the Lounge closes). Absent,
   *  as for a host with its own exit, the link is not drawn. */
  onNotNow?: () => void;
}) {
  // A clip that fails is taken away whole: never "unavailable" on the wall.
  const [deadSrc, setDeadSrc] = useState<string | null>(null);
  const shown = moment && moment.src !== deadSrc ? moment : null;
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
        {shown ? (
          <div data-ready-moment className="flex w-full max-w-sm flex-col gap-2 text-left">
            <WalkPlayer
              look="me"
              seed={shown.seed}
              src={shown.src}
              startOffsetMs={shown.startOffsetMs}
              durationMs={shown.durationMs}
              label={COPY.pagerMoment}
              onError={() => setDeadSrc(shown.src)}
            />
            <WalkMessage>
              <span>{COPY.titleMostConfident}</span>
            </WalkMessage>
          </div>
        ) : null}
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
