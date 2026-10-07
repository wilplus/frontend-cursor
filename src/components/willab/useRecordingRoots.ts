"use client";

import { useEffect, useState } from "react";
import { fetchRecordingRoots } from "@/services/api/idealText";
import type { RecordingRoot } from "./RecordingRoadmap";

/* -------------------------------------------------------------------------- */
/*  useRecordingRoots — the helper words a later Take records with.           */
/*                                                                            */
/*  Take 1 intentionally has no roadmap. Every later recording entry reads    */
/*  the current project again and shows ONLY phrases the user explicitly      */
/*  locked and approved orange. A bounded retry covers the short publication  */
/*  window after a root write; it never guesses a phrase.                     */
/*                                                                            */
/*  ONE READ PER ENTRY (build plan D-RC-4). The read is keyed on the project, */
/*  the Take and whether the speaker is on the way into recording — never on */
/*  which of those screens is showing — so moving from "Getting your mic      */
/*  ready" to the recording screen does not drop the read in flight and start */
/*  another. `settled` says the read has answered (or given up) for exactly   */
/*  this project and Take, so the Take can start with its words in place.     */
/* -------------------------------------------------------------------------- */

/** How long a later Take waits for its helper words before it starts anyway
 *  (LIVE LOOP: the words never block the recording). */
export const ROOTS_WAIT_CAP_MS = 1500;

const RETRIES = 2;
const RETRY_STEP_MS = 350;

export function useRecordingRoots({
  arcId: currentArcId,
  initArc,
  takeIndex,
  signedIn,
  entering,
}: {
  /** The project being recorded, or the one the Lab opened on until then. */
  arcId: string | null;
  initArc: { arcId?: string | null } | null;
  takeIndex: number;
  signedIn: boolean | null;
  /** On the way into recording: the setup, the mic wait or the recording. */
  entering: boolean;
}): { roots: RecordingRoot[]; settled: boolean } {
  const arcId = currentArcId ?? initArc?.arcId ?? null;
  const key =
    arcId && takeIndex > 1 && signedIn === true && entering
      ? `${arcId}:${takeIndex}`
      : null;
  const [roots, setRoots] = useState<RecordingRoot[]>([]);
  const [settledFor, setSettledFor] = useState<string | null>(null);

  useEffect(() => {
    if (!key || !arcId) {
      setRoots([]);
      return;
    }
    let active = true;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const load = async (attempt: number) => {
      const result = await fetchRecordingRoots(arcId);
      if (!active) return;
      if (result.kind === "ready") {
        setRoots(result.roots);
        setSettledFor(key);
        return;
      }
      if (attempt < RETRIES) {
        retry = setTimeout(
          () => void load(attempt + 1),
          RETRY_STEP_MS * (attempt + 1),
        );
        return;
      }
      setSettledFor(key);
    };
    void load(0);
    return () => {
      active = false;
      if (retry) clearTimeout(retry);
    };
    // `arcId` is part of `key`; the key is the read's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { roots, settled: key === null || settledFor === key };
}
