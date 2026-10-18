"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import LoadingState from "./LoadingState";
import Phase1AcceptanceFlow from "./Phase1AcceptanceFlow";
import AccountEndedState from "./AccountEndedState";
import { GateRetry, gateStateFor } from "./Phase1AcceptanceGate";
import {
  fetchAuthorization,
  type AuthorizationStatus,
} from "@/services/api/processingAuthorization";

/* -------------------------------------------------------------------------- */
/*  The Lab's own check at the door (founder 2026-10-18: "ask whatever is      */
/*  needed upfront so whoever goes to the recording has all the permissions;   */
/*  you simply cannot go into the recording without those permissions agreed   */
/*  or rejected").                                                            */
/*                                                                            */
/*  The app-level gate reads the status once, at boot. A guest whose identity  */
/*  stopped verifying since, or who got in on a read that failed open, used    */
/*  to meet the refusal only after "Finish take". So the Lab reads the status  */
/*  afresh as it opens and puts the same acceptance flow, ended state or retry */
/*  in front of every pre-recording screen, exactly as the gate decides them   */
/*  (gateStateFor). A speaker with a valid receipt sees nothing new.           */
/* -------------------------------------------------------------------------- */

export interface LabEntry {
  status: AuthorizationStatus | null;
  attempt: number;
  readAgain: () => void;
  accepted: () => void;
}

/** One read per Lab entry, held by the overlay so the three pre-recording
 *  screens share it. */
export function useLabEntry(): LabEntry {
  const [status, setStatus] = useState<AuthorizationStatus | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus(null);
    void fetchAuthorization().then((next) => {
      if (active) setStatus(next);
    });
    return () => {
      active = false;
    };
  }, [attempt]);
  const readAgain = useCallback(() => setAttempt((n) => n + 1), []);
  const accepted = useCallback(
    () =>
      setStatus((now) =>
        now?.kind === "acceptance_required" ? { kind: "authorized", policy: now.policy } : now,
      ),
    [],
  );
  return { status, attempt, readAgain, accepted };
}

export function LabEntryGate({ entry, children }: { entry: LabEntry; children?: ReactNode }) {
  if (!entry.status) return <LoadingState placement="surface" />;
  const state = gateStateFor(entry.status);
  if (state.kind === "pass") return <>{children}</>;
  if (state.kind === "ended") {
    return <AccountEndedState pendingDeletion={state.pendingDeletion} onCancelled={entry.readAgain} />;
  }
  if (state.kind !== "required") return <GateRetry onRetry={entry.readAgain} />;
  return (
    <Phase1AcceptanceFlow
      key={`${state.policy.policyVersion}:${entry.attempt}`}
      policy={state.policy}
      priorCountry={state.priorCountry}
      onAccepted={entry.accepted}
      onStale={entry.readAgain}
    />
  );
}
