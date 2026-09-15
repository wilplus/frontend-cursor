"use client";

import { useMemo } from "react";
import { readExploreArc } from "@/lib/willab/exploreArc";
import { useUserId } from "./useUserId";

/* -------------------------------------------------------------------------- */
/*  useArcDeckRef — the arc's deck PDF url for the ideal-text reading view     */
/*                                                                            */
/*  Two sources, cheapest-authoritative first:                                 */
/*    1. the ideal-text payload's own presentation_ref,                        */
/*    2. the cached explore arc (localStorage, same device that recorded).     */
/*                                                                            */
/*  A third source — one soft-failing best-presentation GET — was watched in   */
/*  production (2026-09-15/16, audit Q-T4 c2) and deleted with the retired     */
/*  Best Presentation route. null = no deck found → the reading view renders   */
/*  exactly as today.                                                          */
/* -------------------------------------------------------------------------- */

export function useArcDeckRef(
  arcId: string | null,
  payloadRef: string | null,
  /** Kept so the two callers pinned in the MLC-3 manifest stay byte-identical;
   *  it only ever gated the deleted network fallback. */
  settled: boolean
): string | null {
  void settled;
  const userId = useUserId();
  const cached = useMemo(() => {
    if (!arcId) return null;
    const arc = readExploreArc(userId);
    return arc?.arcId === arcId && arc.deck?.presentationRef
      ? arc.deck.presentationRef
      : null;
  }, [arcId, userId]);
  return payloadRef ?? cached;
}
