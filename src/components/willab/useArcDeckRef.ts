"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { readExploreArc } from "@/lib/willab/exploreArc";
import { fetchBestPresentation } from "@/services/api/bestPresentation";
import { useUserId } from "./useUserId";

/* -------------------------------------------------------------------------- */
/*  useArcDeckRef — the arc's deck PDF url for the ideal-text reading view     */
/*                                                                            */
/*  Three sources, cheapest-authoritative first:                               */
/*    1. the ideal-text payload's own presentation_ref (safe-ahead — the BE     */
/*       echoes it on the coach lane already; wins the moment it ships here),   */
/*    2. the cached explore arc (localStorage, same device that recorded),      */
/*    3. one soft-failing best-presentation GET (cross-device / post-eviction). */
/*                                                                            */
/*  null = no deck found → the reading view renders exactly as today. The       */
/*  network fallback fires once per arc, only after the ideal-text GET settled  */
/*  (so a payload-served ref never races it) and only when 1 and 2 both missed. */
/* -------------------------------------------------------------------------- */

export function useArcDeckRef(
  arcId: string | null,
  payloadRef: string | null,
  /** Gate for the network fallback — pass true once the ideal-text GET has
   *  resolved, so a payload that does carry the ref skips the extra fetch. */
  settled: boolean
): string | null {
  const userId = useUserId();
  const [fetched, setFetched] = useState<string | null>(null);
  const triedRef = useRef<string | null>(null);
  const cached = useMemo(() => {
    if (!arcId) return null;
    const arc = readExploreArc(userId);
    return arc?.arcId === arcId && arc.deck?.presentationRef
      ? arc.deck.presentationRef
      : null;
  }, [arcId, userId]);

  const need =
    settled && !!arcId && !payloadRef && !cached && triedRef.current !== arcId;
  useEffect(() => {
    if (!need || !arcId) return;
    triedRef.current = arcId; // one shot per arc
    let active = true;
    void fetchBestPresentation(arcId).then((r) => {
      if (!active || !r || "preparing" in r) return;
      if (r.presentationRef) setFetched(r.presentationRef);
    });
    return () => {
      active = false;
    };
  }, [need, arcId]);

  // A different arc is a different deck — drop the previous fetch result.
  useEffect(() => {
    setFetched(null);
  }, [arcId]);

  return payloadRef ?? cached ?? fetched;
}
