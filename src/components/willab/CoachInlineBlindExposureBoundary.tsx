"use client";

import {
  createElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  acknowledgeCoachInlineBlindRender,
  type CoachInlineBlindReviewHandle,
} from "@/services/api/stateRatings";

interface BlindExposureState {
  exposureId: string | null;
  pending: boolean;
  error: string | null;
}

interface StableRenderRequest {
  renderInstanceId: string;
  clientRenderedAt: string;
  idempotencyKey: string;
}

function stableRenderRequest(
  blindReview: CoachInlineBlindReviewHandle,
): StableRenderRequest {
  const storageKey = `willab:coach-inline-render:${blindReview.presentationId}`;
  try {
    const stored = window.sessionStorage.getItem(storageKey);
    if (stored) {
      const value = JSON.parse(stored) as Partial<StableRenderRequest>;
      if (
        typeof value.renderInstanceId === "string" &&
        typeof value.clientRenderedAt === "string" &&
        typeof value.idempotencyKey === "string"
      ) {
        return value as StableRenderRequest;
      }
    }
  } catch {
    // Storage is an idempotency convenience, never an authorization source.
  }
  const renderInstanceId = crypto.randomUUID();
  const created = {
    renderInstanceId,
    clientRenderedAt: new Date().toISOString(),
    idempotencyKey:
      `coach-inline-visible-render:${blindReview.presentationId}:` +
      renderInstanceId,
  };
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(created));
  } catch {
    // Retries in this mounted boundary still reuse the exact request object.
  }
  return created;
}

/**
 * The D5 visible-render boundary.
 *
 * Fetching or mounting a hidden card is not exposure. Once the exact card
 * intersects the visible viewport, two painted frames elapse before the
 * independently retryable render ACK. An answer can consume only the exact
 * exposure returned here; it never manufactures its own render event.
 */
export default function CoachInlineBlindExposureBoundary({
  blindReview,
  children,
}: {
  blindReview: CoachInlineBlindReviewHandle | null;
  children: (state: BlindExposureState) => ReactNode;
}) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<BlindExposureState>({
    exposureId: null,
    pending: blindReview !== null,
    error: null,
  });

  useEffect(() => {
    setState({
      exposureId: null,
      pending: blindReview !== null,
      error: null,
    });
    if (!blindReview || !targetRef.current) return;
    const exact = blindReview;
    let disposed = false;
    let started = false;
    let firstFrame = 0;
    let paintedFrame = 0;
    const retryTimers: number[] = [];

    const acknowledge = async (
      request: StableRenderRequest,
      attempt = 0,
    ) => {
      if (disposed) return;
      const result = await acknowledgeCoachInlineBlindRender(exact, request);
      if (disposed) return;
      if (result.ok) {
        if (
          result.receipt.reviewAssignmentId !== exact.reviewAssignmentId ||
          result.receipt.presentationId !== exact.presentationId
        ) {
          setState({
            exposureId: null,
            pending: false,
            error: "The visible review receipt did not match this card.",
          });
          return;
        }
        setState({
          exposureId: result.receipt.exposureId,
          pending: false,
          error: null,
        });
        return;
      }
      if (attempt < 2) {
        retryTimers.push(window.setTimeout(
          () => void acknowledge(request, attempt + 1),
          500 * 2 ** attempt,
        ));
        return;
      }
      setState({
        exposureId: null,
        pending: false,
        error: result.error ?? "Couldn't confirm this visible review card.",
      });
    };

    const beginAfterPaint = () => {
      if (started || document.visibilityState !== "visible") return;
      started = true;
      const request = stableRenderRequest(exact);
      firstFrame = window.requestAnimationFrame(() => {
        paintedFrame = window.requestAnimationFrame(() => {
          void acknowledge(request);
        });
      });
    };

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) beginAfterPaint();
    }, { threshold: 0.01 });
    observer.observe(targetRef.current);
    document.addEventListener("visibilitychange", beginAfterPaint);
    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", beginAfterPaint);
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(paintedFrame);
      retryTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [blindReview]);

  return createElement("div", { ref: targetRef }, children(state));
}
