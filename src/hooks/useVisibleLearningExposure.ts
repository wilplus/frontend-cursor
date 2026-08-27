"use client";

import { useEffect, useRef } from "react";
import {
  acknowledgeVisibleLearningExposures,
  newRenderInstanceId,
  type LearningExposureHandle,
} from "@/services/api/learningExposures";

/**
 * A single exposure boundary shared by every learning surface.
 *
 * Data preparation, network fetch and hidden preloading are deliberately not
 * exposure. The acknowledgement starts only after two painted frames while
 * the tab is visible. A stable render instance makes retries idempotent.
 */
export function useVisibleLearningExposure({
  handles,
  visibilityKey,
  enabled,
  actorRole = "owner",
}: {
  handles: readonly LearningExposureHandle[];
  visibilityKey: string;
  enabled: boolean;
  actorRole?: "owner" | "coach" | "peer";
}): void {
  const renderIds = useRef<Map<string, string>>(new Map());
  const handlesRef = useRef(handles);
  handlesRef.current = handles;

  useEffect(() => {
    if (!enabled || handlesRef.current.length === 0) return;
    let firstFrame = 0;
    let paintedFrame = 0;
    let started = false;
    let disposed = false;
    const retryTimers: number[] = [];

    const acknowledge = async (attempt = 0) => {
      if (disposed) return;
      let renderInstanceId = renderIds.current.get(visibilityKey);
      if (!renderInstanceId) {
        renderInstanceId = newRenderInstanceId();
        renderIds.current.set(visibilityKey, renderInstanceId);
      }
      const saved = await acknowledgeVisibleLearningExposures(
        handlesRef.current,
        renderInstanceId,
        actorRole,
      );
      if (!saved && attempt < 2 && !disposed) {
        retryTimers.push(
          window.setTimeout(
            () => void acknowledge(attempt + 1),
            500 * 2 ** attempt,
          ),
        );
      }
    };
    const scheduleAfterPaint = () => {
      if (started || document.visibilityState !== "visible") return;
      started = true;
      firstFrame = window.requestAnimationFrame(() => {
        paintedFrame = window.requestAnimationFrame(() => {
          void acknowledge();
        });
      });
    };
    scheduleAfterPaint();
    document.addEventListener("visibilitychange", scheduleAfterPaint);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", scheduleAfterPaint);
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(paintedFrame);
      retryTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [actorRole, enabled, visibilityKey]);
}
