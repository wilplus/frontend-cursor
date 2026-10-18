"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LoadingState from "./LoadingState";
import Phase1AcceptanceFlow from "./Phase1AcceptanceFlow";
import AccountEndedState from "./AccountEndedState";
import { Button } from "@/components/ui/button";
import {
  AGREEMENT_UNREADABLE,
  fetchAuthorization,
  type AuthorizationStatus,
  type ProcessingPolicy,
} from "@/services/api/processingAuthorization";
import type { PendingDeletion } from "@/services/api/accountDeletion";
import { takeAuthorization } from "@/services/api/bootPrefetch";
import { claimGuestProjects, hasClaimableGuestOwner } from "@/services/api/projects";
import { ENDED_STATE_ENABLED } from "@/lib/legal/leavingCopy";
import { PolicyUpdateProvider } from "./PolicyUpdate";

/* -------------------------------------------------------------------------- */
/*  The Phase-1 boundary, as a gate (Task 5).                                  */
/*                                                                            */
/*  Shaped after Mlc2FounderConsentGate deliberately — same checking/pass/     */
/*  required shape, same place in the tree — so there is one pattern for       */
/*  "something must be agreed before this subtree runs" rather than two.       */
/*                                                                            */
/*  IT FAILS OPEN, AND THAT IS THE DECISION TO ARGUE WITH FIRST.               */
/*                                                                            */
/*  `unavailable` (no active policy) and `error` (the request failed) both     */
/*  render the children. Three reasons, in order of weight:                    */
/*                                                                            */
/*  1. THE BACKEND IS THE ENFORCEMENT AUTHORITY, NOT THIS COMPONENT. When      */
/*     PLF1_PROCESSING_AUTHORIZATION_MODE=enforce, every recording, retry and  */
/*     provider call already passes the canonical authorization path and is    */
/*     refused without a receipt. A client-side block would be a second        */
/*     opinion about a question the server has already answered — exactly the  */
/*     route-local consent logic the standing constraint forbids.              */
/*                                                                            */
/*  2. NO POLICY IS REGISTERED YET, AND THAT IS TODAY'S NORMAL. Failing closed */
/*     on `unavailable` would show every user an acceptance screen with no     */
/*     policy behind it — inventing a policy — or lock them out of a product   */
/*     that is running correctly in `off` mode.                                */
/*                                                                            */
/*  3. LIVE LOOP. A transient fetch failure must not stop record → process →   */
/*     Ideal Text → next Take for everyone. The cost of failing open is that a */
/*     user on a bad connection reaches the Lounge and meets the refusal at    */
/*     record time instead of here; the cost of failing closed is the loop     */
/*     stopping on a network blip. The first is a worse message, the second is */
/*     an outage.                                                              */
/*                                                                            */
/*  THE ONE EXCEPTION (founder 2026-10-18: "you simply cannot go into the      */
/*  recording without those permissions agreed or rejected"): a reader whose   */
/*  IDENTITY the backend refuses even after a fresh guest mint                 */
/*  (`identity_failed`) is blocked here, with a retry. Nothing they record     */
/*  would be accepted; letting them in only moved the refusal to "Finish       */
/*  take". `unavailable` and `error` still pass as above.                       */
/*                                                                            */
/*  What the gate must NEVER do is create, infer or replay a receipt. It only  */
/*  decides whether to show the screen on which the user creates their own.    */
/* -------------------------------------------------------------------------- */

type State =
  | { kind: "checking" }
  /** Authorized, no policy, or unreadable — see the fail-open note above.
   *  `update`: this person accepted an earlier version; the app opens and
   *  the policy update prompt asks for the new one (founder 2026-10-15). */
  | { kind: "pass"; update?: AuthorizationStatus }
  | { kind: "required"; policy: ProcessingPolicy; priorCountry: string | null }
  /** Processing is blocked (PLF-T1, Q19 A): one line, never the acceptance
   *  flow, which a blocked person could never get past. Data & consent stays
   *  reachable — it is outside this gate. */
  | { kind: "ended"; pendingDeletion: PendingDeletion | null }
  /** The reader's identity was refused (identity_failed): one line and a
   *  retry, never the app (founder 2026-10-18). */
  | { kind: "failed" };

/** What the gate does with a status. A block shows the ended state while
 *  ENDED_STATE_ENABLED is on; while it is off (its words are not signed) the
 *  gate does exactly what it did before the block had a kind of its own:
 *  the acceptance flow when a policy came with it, otherwise pass. */
export function gateStateFor(
  status: AuthorizationStatus,
  endedStateEnabled: boolean = ENDED_STATE_ENABLED,
): State {
  if (status.kind === "acceptance_required" && status.acceptedEarlierVersion) {
    return { kind: "pass", update: status };
  }
  if (status.kind === "acceptance_required") {
    return {
      kind: "required",
      policy: status.policy,
      priorCountry: status.priorCountry ?? null,
    };
  }
  if (status.kind === "blocked") {
    if (endedStateEnabled) {
      return { kind: "ended", pendingDeletion: status.pendingDeletion };
    }
    return status.policy
      ? { kind: "required", policy: status.policy, priorCountry: null }
      : { kind: "pass" };
  }
  if (status.kind === "identity_failed") return { kind: "failed" };
  return { kind: "pass" };
}

/** The ended state's layout with the sentence a failed read already has and
 *  the retry word the app already uses: no new words. */
export function GateRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      data-testid="gate-retry"
      className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <p role="alert" className="max-w-[40ch] text-[16px] leading-relaxed text-foreground">
        {AGREEMENT_UNREADABLE}
      </p>
      <Button type="button" variant="outline" className="rounded-full" onClick={onRetry}>
        Try again
      </Button>
    </section>
  );
}

export default function Phase1AcceptanceGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<State>({ kind: "checking" });
  // Bumped to force a refetch after PROCESSING_POLICY_STALE. A stale result
  // means the policy moved under us, so the held hashes are unusable and the
  // screen must be re-presented from fresh bytes. A cancelled deletion bumps
  // it too: the block is lifted, and only a fresh read says what follows.
  const [attempt, setAttempt] = useState(0);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    setState({ kind: "checking" });
    // The first check reuses the boot prefetch (bootPrefetch.ts) so this gate
    // does not wait its turn behind the ones above it; a stale-policy retry
    // always reads fresh.
    //
    // THE CLAIM COMES FIRST (founder 2026-10-18: "as a new user I am
    // displayed for a moment the consent screen again"). A guest accepts,
    // records and signs up; on the first open after that the account has
    // no acceptance of its own until the claim moves the guest's into it.
    // Read before the claim, the status said "accept" and this gate showed
    // the acceptance screen to someone who had already agreed, until the
    // claim landed and the page reloaded. So with a claimable guest on the
    // device the gate waits for the claim (a no-op while signed out, which
    // claims nothing and reads as the guest, as before) and then reads
    // fresh: the prefetched answer was about the account alone.
    const load = async () => {
      if (hasClaimableGuestOwner() && (await claimGuestProjects())) {
        return fetchAuthorization();
      }
      return attempt === 0 ? takeAuthorization() : fetchAuthorization();
    };
    void load().then((status) => {
      if (!active.current) return;
      setState(gateStateFor(status));
    });
    return () => {
      active.current = false;
    };
  }, [attempt]);

  const readAgain = useCallback(() => setAttempt((n) => n + 1), []);
  const onAccepted = useCallback(() => setState({ kind: "pass" }), []);

  if (state.kind === "checking") return <LoadingState placement="surface" />;
  if (state.kind === "pass") {
    return (
      <PolicyUpdateProvider initial={state.update ?? null}>{children}</PolicyUpdateProvider>
    );
  }
  if (state.kind === "ended") {
    return (
      <AccountEndedState
        pendingDeletion={state.pendingDeletion}
        onCancelled={readAgain}
      />
    );
  }
  if (state.kind === "failed") return <GateRetry onRetry={readAgain} />;

  /* A FULL-VIEWPORT TAKEOVER, AND THE REASON IS THE SCROLLBAR (founder
     2026-09-23: "make it scroll on the whole page, so the scroll bar is not
     displayed on the right").

     The surface shell is an app shell: `h-full overflow-hidden` on <main>,
     with a centred `max-w-3xl` column that also clips. That is correct for the
     Lounge, which is a chat with its own scrollable history — but it meant the
     acceptance flow's scroll container was the 768px column, so its scrollbar
     appeared floating inside the content instead of at the edge of the window.

     Escaping with `fixed inset-0` makes the viewport itself the scroller, which
     is what a takeover should be anyway: this screen is the processing
     boundary, not a page within the app. The shell and the Lounge are
     untouched. Being fixed, it pads the notch itself (consent lock
     2026-10-07, the prototype's `.app`), so no step's heading or document
     title sits under the status bar. */
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background pt-[env(safe-area-inset-top)]">
      <div className="flex min-h-full flex-col">
        <Phase1AcceptanceFlow
          // A new policy identity is a new agreement: remount rather than carry
          // a half-finished walk through the old one's steps.
          key={`${state.policy.policyVersion}:${attempt}`}
          policy={state.policy}
          priorCountry={state.priorCountry}
          onAccepted={onAccepted}
          onStale={readAgain}
        />
      </div>
    </div>
  );
}
