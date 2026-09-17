import type { AuthorizationStatus } from "@/services/api/processingAuthorization";

/* -------------------------------------------------------------------------- */
/*  Which text a legal page should show (Task 4).                              */
/*                                                                            */
/*  Lives here rather than inside PublishedPolicyText.tsx for the reason       */
/*  chunkSteps.ts gives: vitest cannot transform .tsx imports, so a rule left  */
/*  inside a component is a rule no unit test can reach. This is the rule;     */
/*  the component is the rendering.                                            */
/* -------------------------------------------------------------------------- */

export type Which = "terms" | "privacy";

export type PolicyTextState =
  /** The policy record answered. Show these exact bytes. */
  | { kind: "published"; copy: string; version: string }
  /** Nothing authoritative to show. Fall back, and SAY it is a fallback. */
  | { kind: "fallback" };

/** Resolve an authorization status into what the page should render.
 *
 *  BOTH NON-POLICY OUTCOMES FALL BACK, AND THAT IS DELIBERATE. `unavailable`
 *  (no active policy) and `error` (the request failed) are very different
 *  facts about the system, but they are the same fact about this page: there
 *  is no authoritative text to show, so show the last published one and label
 *  it. Rendering an empty document, or the static one unlabelled, would both
 *  tell the reader something untrue.
 */
export function policyTextState(
  status: AuthorizationStatus,
  which: Which,
): PolicyTextState {
  if (status.kind === "unavailable" || status.kind === "error") {
    return { kind: "fallback" };
  }
  const document =
    which === "terms" ? status.policy.terms : status.policy.privacy;
  // An active policy with an empty document is not a document. Showing a blank
  // page as "the current terms" is worse than showing the last published ones.
  if (!document.copy.trim()) return { kind: "fallback" };
  return {
    kind: "published",
    copy: document.copy,
    version: document.version,
  };
}
