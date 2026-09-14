"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  const refresh = useCallback(() => {
    const current = ++generation.current;
    if (!confidentMomentBundleEnabled() || !projectId || !takeId || !summary) {
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
  }, [projectId, takeId, summary]);

  useEffect(() => {
    refresh();
    return () => {
      generation.current += 1;
    };
  }, [refresh]);

  return { projection, status, refresh };
}
