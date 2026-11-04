"use client";

import WillabSurface from "@/components/willab/WillabSurface";
import MembersOnly from "@/components/invite/MembersOnly";

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
  insightSessionId,
  bestPresentationArcId,
  idealTextArcId,
  idealTextMode = null,
  idealTextTake = null,
}: {
  sessionId: string | null;
  insightSessionId: string | null;
  bestPresentationArcId: string | null;
  idealTextArcId: string | null;
  idealTextMode?: "feedback" | "review" | null;
  /** `&take=<session_id>`: the Take the coach's link names. */
  idealTextTake?: string | null;
}) {
  // By invitation (backend N471): members only; the guest path is off.
  return (
    <MembersOnly>
      <WillabSurface
        sessionId={sessionId}
        insightSessionId={insightSessionId}
        bestPresentationArcId={bestPresentationArcId}
        idealTextArcId={idealTextArcId}
        idealTextMode={idealTextMode}
        idealTextTake={idealTextTake}
      />
    </MembersOnly>
  );
}
