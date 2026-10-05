"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  cancelAccountDeletion,
  type PendingDeletion,
} from "@/services/api/accountDeletion";
import {
  ACCOUNT_DELETION_CANCEL_ENABLED,
  LEAVING_COPY as COPY,
  deletionDate,
} from "@/lib/legal/leavingCopy";
import { DELETE_ACCOUNT_COPY } from "@/lib/legal/deleteAccountCopy";
import { DATA_CONSENT_COPY } from "@/lib/legal/dataConsentCopy";

/* -------------------------------------------------------------------------- */
/*  The ended state (founder 2026-10-05, N48.4 Q19 A; audit PLF-T1).          */
/*                                                                            */
/*  What a person whose processing is blocked sees in place of the Lounge:    */
/*  one line, and nothing to get past. They used to meet the acceptance flow, */
/*  which re-accepting could never lift. While an account deletion is inside  */
/*  its 7-day window and the backend says it can still be cancelled, the one  */
/*  action is "Cancel deletion" (Q14 A). Data & consent stays one tap away:   */
/*  it is outside the gate, so the person's choices and data stay reachable.  */
/*                                                                            */
/*  Rendered only while ENDED_STATE_ENABLED is on; the cancel only while      */
/*  ACCOUNT_DELETION_CANCEL_ENABLED is too. Both are on since the founder     */
/*  signed their words (W1, W2, S1 A; N50; leavingCopy.ts).                   */
/* -------------------------------------------------------------------------- */

/** The one line. An account deletion with a date still ahead names the day;
 *  without one it is the signed "Your account is being deleted..."; any
 *  other block says only what is true of every block. */
export function endedLine(pending: PendingDeletion | null, now: Date = new Date()): string {
  if (pending?.kind !== "account") return COPY.endedOther;
  const date = deletionDate(pending.completesAfter, now);
  return date ? COPY.accountDeletedOn(date) : DELETE_ACCOUNT_COPY.done;
}

export default function AccountEndedState({
  pendingDeletion,
  onCancelled,
  cancelEnabled = ACCOUNT_DELETION_CANCEL_ENABLED,
}: {
  pendingDeletion: PendingDeletion | null;
  /** The deletion was cancelled and the block lifted: read the status again. */
  onCancelled: () => void;
  cancelEnabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [tooLate, setTooLate] = useState(false);
  const pending = pendingDeletion?.kind === "account" ? pendingDeletion : null;
  const canCancel = cancelEnabled && !!pending?.cancellable && !tooLate;

  async function cancel() {
    if (!pending) return;
    setBusy(true);
    setProblem(null);
    const result = await cancelAccountDeletion(pending.purgeId);
    setBusy(false);
    if (result.kind === "cancelled") {
      onCancelled();
      return;
    }
    if (result.kind === "refused") setTooLate(true);
    setProblem(result.kind === "refused" ? COPY.cancelTooLate : COPY.cancelFailed);
  }

  return (
    <section
      data-testid="account-ended-state"
      className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <p role="status" className="max-w-[40ch] text-[16px] leading-relaxed text-foreground">
        {endedLine(pendingDeletion)}
      </p>
      {canCancel ? (
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={busy}
          onClick={() => void cancel()}
        >
          {COPY.cancel}
        </Button>
      ) : null}
      {problem ? (
        <p role="alert" className="text-[13px] text-destructive">
          {problem}
        </p>
      ) : null}
      <Link
        href="/account/data-consent"
        className="text-[14px] text-muted-foreground underline underline-offset-4"
      >
        {DATA_CONSENT_COPY.title}
      </Link>
    </section>
  );
}
