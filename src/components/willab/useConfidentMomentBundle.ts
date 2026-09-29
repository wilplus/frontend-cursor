"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFeatureOn } from "@/hooks/useRingState";
import { RING_FEATURES } from "@/services/api/rings";
import {
  confidentMomentBundleEnabled,
  fetchConfidentMomentBundles,
  type ConfidentMomentProjection,
  type ConfidentMomentSummary,
} from "@/services/api/confidentMomentBundles";

export function useConfidentMomentBundle({
  projectId,
  takeId,
  summary,
}: {
  projectId: string | null;
  takeId: string | null;
  summary: ConfidentMomentSummary | null;
}) {
  const [projection, setProjection] = useState<ConfidentMomentProjection | null>(null);
  const [status, setStatus] = useState<"off" | "loading" | "ready" | "retry" | "error">("off");
  const generation = useRef(0);
  // Building switch AND the person's ring (the backend rings migration): a person the
  // `confident_moment_bundles` row does not reach never asks for the lane.
  const bundlesOn = useFeatureOn(RING_FEATURES.confidentMomentBundles);

  const refresh = useCallback(() => {
    const current = ++generation.current;
    if (!confidentMomentBundleEnabled() || !bundlesOn || !projectId || !takeId || !summary) {
      setProjection(null);
      setStatus("off");
      return;
    }
    setStatus("loading");
    void fetchConfidentMomentBundles(projectId, takeId).then((result) => {
      if (generation.current !== current) return;
      if (result.kind !== "ready") {
        setProjection(null);
        setStatus(result.kind === "disabled" ? "off" : result.kind);
        return;
      }
      if (result.projection.documentSnapshotId !== summary.documentSnapshotId) {
        setProjection(null);
        setStatus("retry");
        return;
      }
      setProjection(result.projection);
      setStatus("ready");
    });
  }, [bundlesOn, projectId, takeId, summary]);

  useEffect(() => {
    refresh();
    return () => {
      generation.current += 1;
    };
  }, [refresh]);

  return { projection, status, refresh };
}
