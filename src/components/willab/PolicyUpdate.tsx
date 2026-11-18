"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Phase1AcceptanceFlow from "./Phase1AcceptanceFlow";
import {
  fetchAuthorization,
  type AuthorizationStatus,
  type ProcessingPolicy,
} from "@/services/api/processingAuthorization";

/* -------------------------------------------------------------------------- */
/*  A current-policy gate for an app that was already open (backend N664).     */
/*                                                                            */
/*  Phase1AcceptanceGate owns startup. This provider catches the same server   */
/*  truth after startup: a visibility recheck or an authorization refusal.     */
/*  There is deliberately no second prompt, one-tap acceptance, or client      */
/*  version comparison. The canonical consent flow receives the server's       */
/*  current policy and normal app use resumes only after it accepts.            */
/* -------------------------------------------------------------------------- */

const NEEDS_ACCEPTANCE = new Set([
  "PROCESSING_AUTHORIZATION_REQUIRED",
  "PROCESSING_POLICY_STALE",
  "TRAINING_CONSENT_NEEDS_POLICY_RECEIPT",
]);

export function needsPolicyAcceptance(code: string | null | undefined): boolean {
  return !!code && NEEDS_ACCEPTANCE.has(code);
}

const RECHECK_MS = 60_000;

interface Pending {
  policy: ProcessingPolicy;
  priorCountry: string | null;
}

interface PolicyUpdateApi {
  /** Re-read the canonical status and resume the refused action only after
   *  the current policy is accepted. */
  refused: (code: string | null | undefined, resume?: () => void) => void;
  policy: ProcessingPolicy | null;
}

const PolicyUpdateContext = createContext<PolicyUpdateApi | null>(null);

export function usePolicyUpdate(): PolicyUpdateApi | null {
  return useContext(PolicyUpdateContext);
}

function pendingOf(status: AuthorizationStatus): Pending | null {
  if (status.kind !== "acceptance_required") return null;
  return {
    policy: status.policy,
    priorCountry: status.priorCountry ?? null,
  };
}

export function PolicyUpdateProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const resumes = useRef<Array<() => void>>([]);
  const lastRead = useRef(Date.now());

  const read = useCallback(async () => {
    lastRead.current = Date.now();
    const status = await fetchAuthorization();
    if (status.kind === "error") return;
    const next = pendingOf(status);
    if (!next) resumes.current = [];
    setPending(next);
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRead.current < RECHECK_MS) return;
      void read();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [read]);

  const refused = useCallback((code: string | null | undefined, resume?: () => void) => {
    if (!needsPolicyAcceptance(code)) return;
    if (resume) resumes.current.push(resume);
    void read();
  }, [read]);

  const accepted = useCallback(() => {
    setPending(null);
    const queued = resumes.current;
    resumes.current = [];
    queued.forEach((resume) => resume());
  }, []);

  const api = useMemo<PolicyUpdateApi>(() => ({
    refused,
    policy: pending?.policy ?? null,
  }), [refused, pending]);

  return (
    <PolicyUpdateContext.Provider value={api}>
      {children}
      {pending ? (
        <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-background pt-[env(safe-area-inset-top)]">
          <div className="flex min-h-full flex-col">
            <Phase1AcceptanceFlow
              key={pending.policy.policyVersion}
              policy={pending.policy}
              priorCountry={pending.priorCountry}
              onAccepted={accepted}
              onStale={() => void read()}
            />
          </div>
        </div>
      ) : null}
    </PolicyUpdateContext.Provider>
  );
}

// Founder-Approved: N664 makes the newest processing consent a full app gate, 2026-11-18.
