import { redirect } from "next/navigation";

/**
 * /coach/willab/<sessionId> — RETIRED (N1).
 *
 * The standalone per-session authoring page was the architecture violation
 * behind the N1 bug (diagnosis (a), confirmed): review-as-a-route instead of
 * an overlay, so back-nav dropped the coach at /login. It also loaded via the
 * OWNER-auth user re-read (`fetchSessionReadout` → CoachAuthoring) — a
 * non-pseudonymised path that predates the coach contracts.
 *
 * Review now opens as the in-Lounge `CoachReviewOverlay` (coach-auth,
 * §B.4-pseudonymised, split-sink — direction stays private, the user-lane note/
 * tag stays separate). This route forwards into the always-mounted Lounge,
 * carrying the session id as `?review=<id>` so the deep-link can open the
 * overlay there (U12 wires `?review=` → openReview; inert until then — a stray
 * param the Lounge ignores, never a user-flow trigger like `?session=`).
 */
export default function CoachWillabAuthoringRedirect({
  params,
}: {
  params: { sessionId: string };
}) {
  redirect(`/chat?review=${encodeURIComponent(params.sessionId)}`);
}
