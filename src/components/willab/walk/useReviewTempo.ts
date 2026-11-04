"use client";

import { useEffect, useState } from "react";
import { fetchReviewTempo } from "@/services/api/reviewTempo";
import type { TempoStretch } from "@/lib/willab/tempoStep";

/** A failed read is asked again after these, then counts as no stretch: a
 *  failure is not "no stretch" (T), and the walk never waits long on it. */
const RETRY_MS = [600, 1_500] as const;

/** The Take's tempo stretch, asked once per Take as soon as the arc and the
 *  Take are known, so the walk has it before it is opened and held still
 *  (backend N166, step 3); the backend answers the step only to those the
 *  rings panel's row reaches (step 6), so nothing waits on the rings here.
 *  Three answers: undefined while asking (a failed read is asked again,
 *  twice, shortly); null with no stretch, once the reads failed, or with no
 *  arc or Take; else the stretch. */
export function useReviewTempo(arcId: string | null, take: string | null): TempoStretch | null | undefined {
  const [tempo, setTempo] = useState<{ key: string; stretch: TempoStretch | null } | null>(null);
  const key = arcId && take ? `${arcId}:${take}` : null;
  useEffect(() => {
    if (!arcId || !take) return;
    const asked = `${arcId}:${take}`;
    let live = true;
    let timer: number | null = null;
    const settle = (stretch: TempoStretch | null) => setTempo({ key: asked, stretch });
    const ask = (tried: number) => {
      void fetchReviewTempo(arcId, take).then((stretch) => {
        if (!live) return;
        if (stretch !== "failed") settle(stretch);
        else if (tried >= RETRY_MS.length) settle(null);
        else timer = window.setTimeout(() => ask(tried + 1), RETRY_MS[tried]);
      });
    };
    ask(0);
    return () => {
      live = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [arcId, take]);
  if (!key) return null;
  return tempo?.key === key ? tempo.stretch : undefined;
}
