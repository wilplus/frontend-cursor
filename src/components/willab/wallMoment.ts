"use client";

import { useEffect, useState } from "react";
import {
  fetchIdealTextCore,
  fetchIdealTextEnrichment,
  mergeIdealTextEnrichment,
  settleIdealTextEnrichment,
  type DocumentSuggestion,
} from "@/services/api/idealText";
import { SLOW_LANE } from "@/lib/willab/enrichmentSettle";
import { walkMomentGroups } from "@/lib/willab/walkPlan";

/* -------------------------------------------------------------------------- */
/*  The account wall's one moment (founder 2026-10-29, backend N273 item 5;   */
/*  prototype https://claude.ai/artifact/LyE1Xa7M5D2FWXDxFzPKtT)              */
/*                                                                            */
/*  The guest's "Done" screen carries one real piece of their result: the     */
/*  clip of the Take's most confident moment, the moment the Feedback walk    */
/*  opens its praise on with "This was your most confident moment." Read     */
/*  from the same served feedback rows the walk reads (`highestMoment`, the   */
/*  row's own signed clip), through the same owner-or-guest reads. Nothing   */
/*  found, nothing drawn: the wall stays as it was.                           */
/* -------------------------------------------------------------------------- */

export type WallMoment = {
  src: string;
  startOffsetMs: number | null;
  durationMs: number | null;
  /** The bars' seed: the moment's own snippet, as the walk seeds it. */
  seed: string;
};

/** A row the walk praises: green on a tiered backend, else the praise card
 *  (useDeckFeedbackWalk's walkItemOf). Pure. */
function praised(item: DocumentSuggestion): boolean {
  if (item.bookmarkTier != null) return item.bookmarkTier === "confident";
  return item.openCard === "praise" || item.feedbackFamily === "great_formulation";
}

/** The Take's most confident moment, praised, with a clip to play: the
 *  walk's moment (one per block) its praise step opens with "This was your
 *  most confident moment.", and that moment's clip, the praise row's first.
 *  Null when there is none. Pure. */
export function wallMomentOf(items: readonly DocumentSuggestion[] | null | undefined): WallMoment | null {
  if (!items?.length) return null;
  const groups = walkMomentGroups(items.map((item) => ({ start: item.start, slide: 0, blockId: item.blockId ?? null, item })));
  for (const group of groups) {
    const rows = group.map((g) => g.item);
    if (!rows.some((r) => r.highestMoment === true) || !rows.some(praised)) continue;
    const clip = [...rows.filter(praised), ...rows].find((r) => r.snippetAudioRef);
    if (!clip?.snippetAudioRef) return null;
    return {
      src: clip.snippetAudioRef,
      startOffsetMs: clip.startOffsetMs ?? null,
      durationMs: clip.durationMs ?? null,
      seed: `moment-${clip.snippetId ?? clip.id}`,
    };
  }
  return null;
}

/** The wall's moment where the host has not read the page (the Lounge): the
 *  core, then the marks' lane, as the Ideal Text page reads them (owner or
 *  guest, `ownerReadHeaders`). Null until found, and on any failure. */
export function useWallMoment(arcId: string | null, enabled: boolean): WallMoment | null {
  const [moment, setMoment] = useState<WallMoment | null>(null);
  useEffect(() => {
    setMoment(null);
    if (!enabled || !arcId) return;
    let live = true;
    void (async () => {
      try {
        const core = await fetchIdealTextCore(arcId);
        if (!live || core.kind !== "single") return;
        const fromCore = wallMomentOf(core.suggestions);
        if (fromCore || !core.documentSnapshotId) {
          setMoment(fromCore);
          return;
        }
        const lane = await fetchIdealTextEnrichment(arcId, core.documentSnapshotId, SLOW_LANE);
        if (!live || lane.kind !== "ready") return;
        const first = wallMomentOf(mergeIdealTextEnrichment(core, lane).suggestions);
        if (first) {
          setMoment(first);
          return;
        }
        const settled = await settleIdealTextEnrichment(arcId, core.documentSnapshotId, lane);
        if (!live || settled.kind !== "ready") return;
        setMoment(wallMomentOf(mergeIdealTextEnrichment(core, settled).suggestions));
      } catch {
        // The wall stays as it was.
      }
    })();
    return () => {
      live = false;
    };
  }, [arcId, enabled]);
  return moment;
}
