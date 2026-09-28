"use client";

import { useCallback, useEffect, useState } from "react";
import Phase1AcceptanceFlow from "@/components/willab/Phase1AcceptanceFlow";
import {
  fetchAuthorization,
  type ProcessingPolicy,
} from "@/services/api/processingAuthorization";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";

/* -------------------------------------------------------------------------- */
/*  "What's changed since you agreed" (founder 2026-09-28, decision 21).       */
/*                                                                            */
/*  Shown on the Data page, and only there, when a newer processing policy    */
/*  replaced the one this person accepted. It is not a second consent path:   */
/*  "Accept the update" opens the ordinary acceptance screen for the policy   */
/*  in force — its own agreement text, the optional Personalised practice    */
/*  tick, and the age and country confirmations a receipt needs — so the     */
/*  new receipt is written by the one canonical boundary.                    */
/*                                                                            */
/*  DARK UNTIL THE POLICY IS REPUBLISHED. While everyone's receipt is for the */
/*  policy in force, the server never reports an earlier version and this    */
/*  renders nothing. Never shown to someone who has not agreed before: they  */
/*  meet the acceptance screen where recording starts, not an "update".      */
/* -------------------------------------------------------------------------- */

export default function PolicyUpdateCard({
  onAccepted,
}: {
  /** A new receipt exists: the page re-reads the choices it depends on. */
  onAccepted?: () => void;
}) {
  const [policy, setPolicy] = useState<ProcessingPolicy | null>(null);
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    void fetchAuthorization().then((status) => {
      if (!alive) return;
      setPolicy(
        status.kind === "acceptance_required" && status.acceptedEarlierVersion
          ? status.policy
          : null,
      );
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const accepted = useCallback(() => {
    setOpen(false);
    setPolicy(null);
    onAccepted?.();
  }, [onAccepted]);
  // The policy moved under us: fetch fresh bytes and present them again.
  const stale = useCallback(() => {
    setOpen(false);
    setAttempt((n) => n + 1);
  }, []);

  if (!policy) return null;
  return (
    <>
      <section
        data-testid="policy-update-card"
        aria-label={COPY.updateTitle}
        className="mt-6 flex flex-col gap-4 rounded-2xl border border-primary/40 p-5"
      >
        <h2 className="text-base font-semibold">{COPY.updateTitle}</h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background"
        >
          {COPY.updateAccept}
        </button>
      </section>
      {open ? (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background">
          <div className="flex min-h-full flex-col">
            <Phase1AcceptanceFlow
              key={`${policy.policyVersion}:${attempt}`}
              policy={policy}
              onAccepted={accepted}
              onStale={stale}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
