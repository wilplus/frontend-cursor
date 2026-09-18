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
  // The ref this hook already handed out, so a re-signed URL for the SAME
  // object does not reload the deck. See `mediaObjectIdentity`.
  const stable = useRef<{ arcId: string | null; ref: string | null }>({
    arcId: null,
    ref: null,
  });
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
    // Retirement watch (founder, 2026-09-14): this fallback is scheduled for
    // deletion once a day of logs shows it never fires. The `source` marker
    // makes the BFF and the backend log the same event server-side, where the
    // logs can actually be read.
    console.warn(`[deck-ref-fallback] fired for arc ${arcId}`);
    let active = true;
    void fetchBestPresentation(arcId, { source: "deck-ref-fallback" }).then((r) => {
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

  return holdWhileSameObject(
    stable,
    payloadRef ?? cached ?? fetched,
    arcId,
  );
}

/** The object a media ref addresses, with the signature stripped.
 *
 *  THE DECK FLICKER (founder 2026-09-18: "for a moment it is then it
 *  disappears"). Deck URLs used to be permanent public links, so the same read
 *  returned the same string forever and nothing downstream ever saw a change.
 *  Since user content began signing on read, every GET re-mints a FRESH
 *  presigned URL for the same object — correct, and deliberately so, but it
 *  means the string changes on every refetch.
 *
 *  `DeckSlidePreview` keys its failure reset on the url, and pdf.js reloads the
 *  document when it changes, so a poll or a settled enrichment tore down a
 *  rendering document and started it again. The page appeared, vanished, and
 *  appeared — which is what a speaker mid-take actually sees.
 *
 *  Identity is the path: one R2 object, one path, regardless of how many times
 *  it is signed. */
function mediaObjectIdentity(ref: string | null): string | null {
  if (!ref) return null;
  const query = ref.indexOf("?");
  return query === -1 ? ref : ref.slice(0, query);
}

/** Keep serving the ref we already handed out while it still addresses the
 *  same object. A genuinely different deck (or arc) replaces it at once. */
function holdWhileSameObject(
  held: { current: { arcId: string | null; ref: string | null } },
  next: string | null,
  arcId: string | null,
): string | null {
  const same =
    held.current.arcId === arcId &&
    !!held.current.ref &&
    mediaObjectIdentity(held.current.ref) === mediaObjectIdentity(next);
  if (!same) held.current = { arcId, ref: next };
  return held.current.ref;
}
