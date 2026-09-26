"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LoadingState from "./LoadingState";
import Phase1AcceptanceFlow from "./Phase1AcceptanceFlow";
import {
  fetchAuthorization,
  type ProcessingPolicy,
} from "@/services/api/processingAuthorization";
import { takeAuthorization } from "@/services/api/bootPrefetch";

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
/*  What the gate must NEVER do is create, infer or replay a receipt. It only  */
/*  decides whether to show the screen on which the user creates their own.    */
/* -------------------------------------------------------------------------- */

type State =
  | { kind: "checking" }
  /** Authorized, no policy, or unreadable — see the fail-open note above. */
  | { kind: "pass" }
  | { kind: "required"; policy: ProcessingPolicy };

export default function Phase1AcceptanceGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<State>({ kind: "checking" });
  // Bumped to force a refetch after PROCESSING_POLICY_STALE. A stale result
  // means the policy moved under us, so the held hashes are unusable and the
  // screen must be re-presented from fresh bytes.
  const [attempt, setAttempt] = useState(0);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    setState({ kind: "checking" });
    // The first check reuses the boot prefetch (bootPrefetch.ts) so this gate
    // does not wait its turn behind the ones above it; a stale-policy retry
    // always reads fresh.
    const load = attempt === 0 ? takeAuthorization : fetchAuthorization;
    void load().then((status) => {
      if (!active.current) return;
      setState(
        status.kind === "acceptance_required"
          ? { kind: "required", policy: status.policy }
          : { kind: "pass" },
      );
    });
    return () => {
      active.current = false;
    };
  }, [attempt]);

  const onStale = useCallback(() => setAttempt((n) => n + 1), []);
  const onAccepted = useCallback(() => setState({ kind: "pass" }), []);

  if (state.kind === "checking") return <LoadingState placement="surface" />;
  if (state.kind === "pass") return <>{children}</>;

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
     untouched. */
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background">
      <div className="flex min-h-full flex-col">
        <Phase1AcceptanceFlow
          // A new policy identity is a new agreement: remount rather than carry
          // a half-finished walk through the old one's steps.
          key={`${state.policy.policyVersion}:${attempt}`}
          policy={state.policy}
          onAccepted={onAccepted}
          onStale={onStale}
        />
      </div>
    </div>
  );
}
