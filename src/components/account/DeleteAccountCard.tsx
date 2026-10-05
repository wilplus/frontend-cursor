"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/willab/ProjectRowMenu";
import { requestAccountDeletion } from "@/services/api/accountDeletion";
import {
  ACCOUNT_DELETE_ENABLED,
  DELETE_ACCOUNT_COPY as COPY,
} from "@/lib/legal/deleteAccountCopy";

/* -------------------------------------------------------------------------- */
/*  Delete my account, in Data & consent (founder 2026-10-05, Q3a).           */
/*                                                                            */
/*  One button, then the shared confirm; nothing is sent before "Delete my   */
/*  account" in the confirm. The backend records the request and stops new   */
/*  processing (request_phase1_purge_v1); an operator finishes it. On since  */
/*  the founder signed the words (ACCOUNT_DELETE_ENABLED, 2026-10-05).        */
/* -------------------------------------------------------------------------- */

export default function DeleteAccountCard({ enabled = ACCOUNT_DELETE_ENABLED }: { enabled?: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  if (!enabled) return null;
  return (
    <section className="mt-8 rounded-xl border border-border p-4" data-testid="delete-account-card">
      <h2 className="text-base font-semibold">{COPY.title}</h2>
      {done ? (
        <p className="mt-2 text-sm text-foreground" role="status">{COPY.done}</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">{COPY.body}</p>
          <Button variant="outline" className="mt-3 text-destructive" onClick={() => setConfirming(true)}>
            {COPY.button}
          </Button>
        </>
      )}
      {confirming ? (
        <ConfirmDelete
          copy={{ title: COPY.confirmTitle, body: COPY.confirmBody, confirmLabel: COPY.confirmLabel }}
          onCancel={() => setConfirming(false)}
          onDelete={async () => {
            const ok = await requestAccountDeletion();
            if (ok) {
              setConfirming(false);
              setDone(true);
            }
            return ok;
          }}
        />
      ) : null}
    </section>
  );
}
