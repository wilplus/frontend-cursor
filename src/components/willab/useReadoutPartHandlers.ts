"use client";

import { useCallback, type MutableRefObject } from "react";
import type { DeckChunk } from "@/lib/willab/deckChunks";
import { reconcileParts, withPartRootPhrase, type Part } from "@/lib/willab/documentParts";
import { setPartHelperWordsFromTake, setPartLock } from "@/services/api/partLock";

/** THE LANDING COPY GETS THE SAME HANDS (F1 Repair Plan Phase 5).
 *
 *  The text screen a speaker lands on after waiting in the Lab
 *  (IdealTextReadout) mounted the deck without three handlers the main text
 *  page (IdealTextOverlay) passes. So there, Delete cleared the helper words
 *  but left the lock (and the Slide's earlier-Take words) in place, words
 *  from an earlier Take could never be saved, and an answered moment kept
 *  its open state until a refetch. These are the overlay's three handlers,
 *  reading the readout's refs. Wiring only: nothing new is drawn. */
export function useReadoutPartHandlers({
  arcIdRef,
  textRef,
  partsRef,
  setParts,
  refetch,
}: {
  arcIdRef: MutableRefObject<string | null>;
  textRef: MutableRefObject<string>;
  partsRef: MutableRefObject<readonly Part[] | null>;
  setParts: (parts: Part[]) => void;
  refetch: () => void;
}) {
  /** Lift the lock on one paragraph (founder lock 2026-09-30, D4). */
  const unlockPart = useCallback(
    async (chunk: DeckChunk): Promise<boolean> => {
      const aid = arcIdRef.current;
      if (!aid) return false;
      const parts = reconcileParts(textRef.current, partsRef.current ?? []);
      const target = parts[chunk.paragraphIndex];
      if (!target) return false;
      const r = await setPartLock(aid, target.id, false, textRef.current);
      if (r.kind === "stale") refetch();
      if (r.kind !== "ok") return false;
      partsRef.current = parts.map((p) => (p.id === target.id ? { ...p, locked: false } : p));
      refetch();
      return true;
    },
    [arcIdRef, textRef, partsRef, refetch],
  );

  /** Helper words from an earlier Take (B4, D5): stored on the Slide, and the
   *  paragraph's own span cleared with them. */
  const setHelperWordsFromTake = useCallback(
    async (chunk: DeckChunk, phrase: string, takeIndex: number): Promise<boolean> => {
      const aid = arcIdRef.current;
      if (!aid) return false;
      const parts = reconcileParts(textRef.current, partsRef.current ?? []);
      const target = parts[chunk.paragraphIndex];
      if (!target) return false;
      const ok = await setPartHelperWordsFromTake(aid, target.id, phrase, takeIndex);
      if (!ok) return false;
      const nextParts = withPartRootPhrase(parts, target.id, null);
      partsRef.current = nextParts;
      setParts(nextParts);
      return true;
    },
    [arcIdRef, textRef, partsRef, setParts],
  );

  return { unlockPart, setHelperWordsFromTake };
}
