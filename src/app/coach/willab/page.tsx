import { redirect } from "next/navigation";

/**
 * /coach/willab — RETIRED (N1).
 *
 * This standalone queue was a *route*, which violated the architecture
 * invariant: "the Lounge is the always-mounted hub; review is an overlay, not
 * a route." Because it was a separate page, browser-back walked history out of
 * the authenticated shell and dropped the coach at /login (the N1 bug, diagnosis
 * (a) — route-vs-overlay, confirmed by the founder).
 *
 * The coach review queue now lives INLINE in the Lounge: `useReviewQueue`
 * interleaves "session ready to label" bubbles into the chat thread, and each
 * opens the in-Lounge `CoachReviewOverlay` (coach-auth, §B.4-pseudonymised,
 * split-sink) via state — no navigation, no remount, no bounce. This route just
 * forwards there so any bookmark keeps working instead of 404-ing.
 */
export default function CoachWillabQueueRedirect() {
  redirect("/chat");
}
