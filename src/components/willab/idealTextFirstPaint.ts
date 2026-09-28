"use client";

import { useEffect, useState } from "react";
import {
  mergeIdealTextEnrichment,
  type IdealTextEnrichmentResult,
  type IdealTextResult,
} from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  The Ideal Text opens with its words AND its button (founder 2026-09-28,   */
/*  "A"; the locked design's J1: words first, the record button available at  */
/*  once, the bookmarks landing a moment later).                              */
/*                                                                            */
/*  The bottom button needs one fact on Takes 1–3: has the speaker seen       */
/*  "next steps"? It must never guess (18 Sep), so it stayed blank until the  */
/*  fact arrived, and the fact arrived last: it rides the fast enrichment     */
/*  lane, but the page only applied that lane once the slow one (the          */
/*  bookmarks) had answered too. Two changes, both timing only:               */
/*                                                                            */
/*    1. The fast lane's answer to that one fact is applied the moment it     */
/*       lands (`applyEarlyJourney`). Everything else still waits for both    */
/*       lanes exactly as before.                                             */
/*    2. The first paint holds for it, at most FIRST_PAINT_HOLD_MS, so the    */
/*       words and the right button appear together (`useFirstPaintHold`).   */
/*       Only the first paint: a page already showing never goes back to      */
/*       loading, and the record entry never waits on the feedback itself.   */
/*                                                                            */
/*  In a file of its own because IdealTextOverlay is grandfathered at the     */
/*  complexity ratchet and may only shrink.                                   */
/* -------------------------------------------------------------------------- */

export const FIRST_PAINT_HOLD_MS = 1500;

type Core = Extract<IdealTextResult, { kind: "single" }>;

/** Apply only the "next steps seen" answer from the fast lane, at once. */
export function applyEarlyJourney<T extends { journeyNextStepsSeen: boolean | null }>(
  prompt: IdealTextEnrichmentResult,
  core: Core,
  setSd: (update: (prev: T | null) => T | null) => void,
  isCurrent: () => boolean,
): void {
  if (!isCurrent() || prompt.kind !== "ready") return;
  const seen = mergeIdealTextEnrichment(core, prompt).journeyNextStepsSeen;
  if (typeof seen !== "boolean") return;
  setSd((prev) => (prev ? { ...prev, journeyNextStepsSeen: seen } : prev));
}

/** Whether the bottom button still needs the "next steps" answer. */
export function buttonUndecided(
  takeCount: number | null | undefined,
  journeyNextStepsSeen: boolean | null | undefined,
): boolean {
  const guided = typeof takeCount === "number" && takeCount >= 1 && takeCount <= 3;
  return guided && typeof journeyNextStepsSeen !== "boolean";
}

/** The status the page draws: "loading" while its first paint waits for the
 *  button's answer (bounded), then the real status for good. */
export function useFirstPaintHold<S extends string>(
  status: S,
  takeCount: number | null | undefined,
  journeyNextStepsSeen: boolean | null | undefined,
): S | "loading" {
  const waiting = status === "ready" && buttonUndecided(takeCount, journeyNextStepsSeen);
  const [released, setReleased] = useState(false);
  useEffect(() => {
    if (status === "ready" && !waiting) setReleased(true);
  }, [status, waiting]);
  useEffect(() => {
    if (!waiting || released) return;
    const timer = setTimeout(() => setReleased(true), FIRST_PAINT_HOLD_MS);
    return () => clearTimeout(timer);
  }, [waiting, released]);
  return waiting && !released ? "loading" : status;
}
