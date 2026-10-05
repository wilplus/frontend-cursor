"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/willab/ProjectRowMenu";
import {
  cancelAccountDeletion,
  requestAccountDeletion,
  type PendingDeletion,
} from "@/services/api/accountDeletion";
import {
  fetchAuthorization,
  pendingAccountDeletion,
} from "@/services/api/processingAuthorization";
import {
  ACCOUNT_DELETE_ENABLED,
  DELETE_ACCOUNT_COPY as COPY,
} from "@/lib/legal/deleteAccountCopy";
import {
  ACCOUNT_DELETION_CANCEL_ENABLED,
  LEAVING_COPY as LEAVING,
  deletionDate,
} from "@/lib/legal/leavingCopy";

/* -------------------------------------------------------------------------- */
/*  Delete my account, in Data & consent (founder 2026-10-05, Q3a).           */
/*                                                                            */
/*  One button, then the shared confirm; nothing is sent before "Delete my   */
/*  account" in the confirm. The backend records the request and stops new   */
/*  processing (request_phase1_purge_v1). On since the founder signed the    */
/*  words (ACCOUNT_DELETE_ENABLED, 2026-10-05).                               */
/*                                                                            */
/*  A deletion already under way is read from the status on arrival, so a    */
/*  reload says so in the signed words instead of offering the button again. */
/*  Cancelling inside the 7-day window (N48.4 Q14 A) and the window's words   */
/*  wait for the founder (ACCOUNT_DELETION_CANCEL_ENABLED, leavingCopy.ts).  */
/* -------------------------------------------------------------------------- */

async function readPending(): Promise<PendingDeletion | null> {
  return pendingAccountDeletion(await fetchAuthorization());
}

/** The line while a deletion is under way: the day it completes once the
 *  window's words are signed, the signed words otherwise. */
function pendingLine(pending: PendingDeletion | null, cancelEnabled: boolean): string {
  const date = cancelEnabled ? deletionDate(pending?.completesAfter ?? null) : null;
  return date ? LEAVING.accountDeletedOn(date) : COPY.done;
}

export default function DeleteAccountCard({
  enabled = ACCOUNT_DELETE_ENABLED,
  cancelEnabled = ACCOUNT_DELETION_CANCEL_ENABLED,
  loadPending = readPending,
}: {
  enabled?: boolean;
  cancelEnabled?: boolean;
  /** The account deletion already under way, if any. */
  loadPending?: () => Promise<PendingDeletion | null>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState<PendingDeletion | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [tooLate, setTooLate] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadPending()
      .catch(() => null)
      .then((found) => {
        if (alive && found) setPending(found);
      });
    return () => {
      alive = false;
    };
  }, [enabled, loadPending]);

  if (!enabled) return null;

  const underWay = done || pending !== null;
  const canCancel = cancelEnabled && !!pending?.cancellable && !tooLate;

  async function cancel() {
    if (!pending) return;
    setBusy(true);
    setProblem(null);
    const result = await cancelAccountDeletion(pending.purgeId);
    setBusy(false);
    if (result.kind === "cancelled") {
      setPending(null);
      setDone(false);
      setCancelled(true);
      return;
    }
    if (result.kind === "refused") setTooLate(true);
    setProblem(result.kind === "refused" ? LEAVING.cancelTooLate : LEAVING.cancelFailed);
  }

  return (
    <section className="mt-8 rounded-xl border border-border p-4" data-testid="delete-account-card">
      <h2 className="text-base font-semibold">{COPY.title}</h2>
      {underWay ? (
        <>
          <p className="mt-2 text-sm text-foreground" role="status">
            {pendingLine(pending, cancelEnabled)}
          </p>
          {canCancel ? (
            <Button
              variant="outline"
              className="mt-3"
              disabled={busy}
              onClick={() => void cancel()}
            >
              {LEAVING.cancel}
            </Button>
          ) : null}
          {problem ? (
            <p className="mt-2 text-sm text-destructive" role="alert">{problem}</p>
          ) : null}
        </>
      ) : (
        <>
          {cancelled ? (
            <p className="mt-2 text-sm text-foreground" role="status">{LEAVING.cancelled}</p>
          ) : null}
          <p className="mt-2 text-sm text-muted-foreground">{COPY.body}</p>
          <Button variant="outline" className="mt-3 text-destructive" onClick={() => setConfirming(true)}>
            {COPY.button}
          </Button>
        </>
      )}
      {confirming ? (
        <ConfirmDelete
          copy={{
            title: COPY.confirmTitle,
            body: cancelEnabled ? LEAVING.accountConfirmBody : COPY.confirmBody,
            confirmLabel: COPY.confirmLabel,
          }}
          onCancel={() => setConfirming(false)}
          onDelete={async () => {
            const result = await requestAccountDeletion();
            if (result.ok) {
              setConfirming(false);
              setCancelled(false);
              setTooLate(false);
              setProblem(null);
              setPending(result.pending);
              setDone(true);
            }
            return result.ok;
          }}
        />
      ) : null}
    </section>
  );
}
