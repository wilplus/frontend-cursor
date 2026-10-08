"use client";

/* -------------------------------------------------------------------------- */
/*  What happened, seeded from the saved answer (founder 2026-10-08,          */
/*  coach-panel waiting time C2).                                             */
/*                                                                            */
/*  The label PUT now answers with the moment's read (`moment_read`, the body */
/*  of GET …/snippets/:snip/moment), so the screen after Judge needs no      */
/*  second request. The host keeps that read here when the save returns it,  */
/*  and the screen takes it once, on its first read of the moment; any later */
/*  visit reads the moment fresh, as before. With no seed (an older backend) */
/*  the read is fetchMomentRead, unchanged.                                  */
/*                                                                            */
/*  BLIND COACH: a seed only ever comes from a SAVED answer's response, so    */
/*  nothing about a moment is held before its rating is saved.               */
/* -------------------------------------------------------------------------- */

import { useRef } from "react";
import { fetchMomentRead, type MomentRead } from "@/services/api/coachWalk";

export interface MomentReadSeeds {
  /** Keep the read a saved answer returned. */
  put: (snippetId: string, read: MomentRead) => void;
  /** The kept read, once: taking it forgets it. */
  take: (snippetId: string) => MomentRead | undefined;
}

export function createMomentReadSeeds(): MomentReadSeeds {
  const kept = new Map<string, MomentRead>();
  return {
    put: (snippetId, read) => { kept.set(snippetId, read); },
    take: (snippetId) => {
      const read = kept.get(snippetId);
      kept.delete(snippetId);
      return read;
    },
  };
}

/** One store per host, stable across renders. */
export function useMomentReadSeeds(): MomentReadSeeds {
  const seeds = useRef<MomentReadSeeds | null>(null);
  if (!seeds.current) seeds.current = createMomentReadSeeds();
  return seeds.current;
}

/** The moment's read: the seed when the save brought one, else the GET. */
export function readMoment(
  seeds: MomentReadSeeds | null | undefined,
  sessionId: string,
  snippetId: string,
): Promise<MomentRead | null> {
  const seeded = seeds?.take(snippetId);
  return seeded ? Promise.resolve(seeded) : fetchMomentRead(sessionId, snippetId);
}
