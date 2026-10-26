"use client";

import { useEffect, useState } from "react";
import { fetchReviewTempo } from "@/services/api/reviewTempo";
import type { TempoStretch } from "@/lib/willab/tempoStep";

/** The Take's tempo stretch, asked once per Take as the page opens, so the
 *  walk has it before it is opened and held still (backend N166, step 3).
 *  Null while asking, with no stretch, or with no arc or Take. */
export function useReviewTempo(arcId: string | null, take: string | null): TempoStretch | null {
  const [tempo, setTempo] = useState<{ key: string; stretch: TempoStretch | null } | null>(null);
  const key = arcId && take ? `${arcId}:${take}` : null;
  useEffect(() => {
    if (!arcId || !take) return;
    let live = true;
    void fetchReviewTempo(arcId, take).then((stretch) => {
      if (live) setTempo({ key: `${arcId}:${take}`, stretch });
    });
    return () => {
      live = false;
    };
  }, [arcId, take]);
  return key && tempo?.key === key ? tempo.stretch : null;
}
