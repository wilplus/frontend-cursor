import { Suspense } from "react";
import ChatPageClient from "./page.client";
import LoadingState from "@/components/willab/LoadingState";
import { isUuid } from "@/lib/uuid";

/** Avoid static prerender (search params + client subtree). */
export const dynamic = "force-dynamic";

function firstQueryValue(
  value: string | string[] | undefined
): string | null {
  if (typeof value === "string") return value || null;
  if (Array.isArray(value) && value[0]) return value[0];
  return null;
}

/** A project id from the address bar, or null when it is not one. A link
 *  carrying `?lens=…` (the founder's, 2026-10-18 — an ellipsis where the id
 *  should be) opened the Ideal Text on a project the server could never
 *  have, and its waiting screen asked for that document for 27 minutes.
 *  Project ids are UUIDs; anything else opens the chat and nothing more. */
function arcQueryValue(value: string | string[] | undefined): string | null {
  const id = firstQueryValue(value);
  return isUuid(id) ? id : null;
}

export default function ChatPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // Phase-aware param: `?session=<id>` is the canonical deep-link
  // (post-finalize redirect, admin email) for the review→roleplay
  // loop. The legacy `?sourceSnippet=` / `?intent=` deep-links from
  // the old contextual-chat era are now resolved by the page itself —
  // if `session` isn't present but `sourceSnippet` is, we treat it
  // as a request to jump into review for that snippet's parent
  // session. For now we forward both so existing email links keep
  // working until backend stops emitting them.
  const sessionId = firstQueryValue(searchParams.session);
  // D3 — user results email deep-link: `?insight=<id>` opens the in-Lounge
  // InsightsOverlay for that session on mount. User-side (the ResultsReadyEmail
  // CTA). The coach's `?review=` deep link left with the take-review overlay
  // (founder 2026-09-30, B3; P2-19).
  const insightSessionId = firstQueryValue(searchParams.insight);
  // C — best-presentation deep-link: `?arc=<arc_id>` opens the in-Lounge
  // BestPresentationOverlay for that arc on mount (the "best presentation ready"
  // card / email CTA).
  const bestPresentationArcId = arcQueryValue(searchParams.arc);
  // The coach-feedback email CTA: `?idealArc=<arc_id>` opens THAT arc's ideal
  // text on mount (founder 2026-08-15). The email whose whole subject is "your
  // coach reviewed this talk" used to land on bare /chat and leave the student
  // hunting the right bubble. Distinct from `?arc=` (best presentation).
  // The lens screen's own address (founder 2026-10-14): `?lens=<arc_id>`
  // opens that project's walk as its own screen, on the coach's feedback
  // (the WhatsApp link), or the review with `&mode=review`.
  const lensArcId = arcQueryValue(searchParams.lens);
  const idealTextArcId = arcQueryValue(searchParams.idealArc) ?? lensArcId;
  // `&feedback=1` (founder 2026-09-25, Q28 A): open with the sheet already on
  // the coach's first reviewed moment.
  const review = lensArcId !== null && firstQueryValue(searchParams.mode) === "review";
  const idealTextMode =
    firstQueryValue(searchParams.feedback) === "1" || (lensArcId !== null && !review)
      ? "feedback"
      : review
        ? "review"
        : null;

  return (
    <Suspense fallback={<LoadingState placement="viewport" />}>
      <ChatPageClient
        sessionId={sessionId}
        insightSessionId={insightSessionId}
        bestPresentationArcId={bestPresentationArcId}
        idealTextArcId={idealTextArcId}
        idealTextMode={idealTextMode}
      />
    </Suspense>
  );
}
