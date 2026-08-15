"use client";

import WillabSurface from "@/components/willab/WillabSurface";

/**
 * /chat — the willab product surface.
 *
 * Phase 5 clearance (D1 = REPLACE): the legacy charisma/stress funnel that used
 * to live here behind `NEXT_PUBLIC_WILLAB_BETA` has been removed. willab is now
 * the only product; this is a thin client wrapper over WillabSurface, which owns
 * the whole flow (Welcome → Intake → Lounge → Lab → Readout → Send → Insights).
 */
export default function ChatPageClient({
  sessionId,
  reviewSessionId,
  insightSessionId,
  bestPresentationArcId,
  idealTextArcId,
}: {
  sessionId: string | null;
  reviewSessionId: string | null;
  insightSessionId: string | null;
  bestPresentationArcId: string | null;
  idealTextArcId: string | null;
}) {
  return (
    <WillabSurface
      sessionId={sessionId}
      reviewSessionId={reviewSessionId}
      insightSessionId={insightSessionId}
      bestPresentationArcId={bestPresentationArcId}
      idealTextArcId={idealTextArcId}
    />
  );
}
