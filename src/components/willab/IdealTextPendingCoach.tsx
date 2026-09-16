"use client";

import { Mic } from "lucide-react";

/** The screen a speaker lands on when their ideal text is not yet approved.
 *
 *  THE LOOP NEVER WAITS FOR A COACH (founder 2026-09-16). Tapping Record on a
 *  project whose ideal text is unapproved routed here, and this state rendered
 *  the sentence below and NOTHING else — no button, no recorder. The user had
 *  asked to record and could not, until a human acted. That is the live-loop
 *  fence, not a rough edge: "the record → process → Ideal Text → next-Take
 *  loop never waits for a coach."
 *
 *  The way out is the way everyone else records. `onReadAloud` is the same
 *  callback the ready state's IdealTextActions calls, so a take started here
 *  goes through the identical submission path — there is no second lane to
 *  drift. `null` is the version hint the ready state would pass; both callers
 *  already handle it (Lounge uses `(version ?? 0) + 1`, and the backend
 *  reconciles the real take index on upload).
 *
 *  ITS OWN FILE because the overlay is at the complexity ratchet's grandfather
 *  line and may only come down: adding the conditional inline pushed it 52 →
 *  53 and the gate refused it. Extracting is the fix the ratchet is asking
 *  for, not a workaround — this branch is a screen, and screens are
 *  components.
 *
 *  L1: the coach's unapproved document is not read, rebuilt or edited here.
 *  BLIND COACH: nothing about the coach's state is surfaced beyond the
 *  sentence that was already on this screen.
 */
export default function IdealTextPendingCoach({
  onReadAloud,
}: {
  onReadAloud?: (version: number | null) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-16">
      <p className="text-center text-[15px] leading-relaxed text-muted-foreground">
        Your coach is still shaping your ideal text. It lands here the moment
        it&apos;s approved.
      </p>
      {onReadAloud ? (
        <button
          type="button"
          onClick={() => onReadAloud(null)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border px-6 text-[15px] font-medium text-foreground"
        >
          <Mic className="h-4 w-4" aria-hidden />
          Record the next take
        </button>
      ) : null}
    </div>
  );
}
