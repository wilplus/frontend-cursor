"use client";

/* -------------------------------------------------------------------------- */
/*  The walk's Judge screen on the confidence chain (founder 2026-10-05,       */
/*  decisions log N48.5 Q27 A: "the coach walk's blind labels as its          */
/*  judgements").                                                             */
/*                                                                            */
/*  In the chain's own order: when the moment's clip is on screen, ask for    */
/*  the blind packet (prepareConfidenceChainPacket), and once the screen has  */
/*  painted, send the post-paint receipt (acknowledgeConfidenceChainRender).  */
/*  The receipt's exposure id rides the coach's answer on the label PUT,      */
/*  which writes the immutable blind judgement and its reveal after the save. */
/*                                                                            */
/*  INVISIBLE. Nothing here renders, waits or speaks: no handle (the chain    */
/*  did not select this moment, the coach already rated it, the chain is      */
/*  dark) or any failure leaves the echo empty, and the answer is saved       */
/*  exactly as before. The handle is four identifiers and nothing about the   */
/*  moment (BLIND COACH).                                                     */
/* -------------------------------------------------------------------------- */

import { useEffect, useRef } from "react";
import {
  acknowledgeConfidenceChainRender,
  prepareConfidenceChainPacket,
  type ConfidenceChainBlindHandle,
} from "@/services/api/stateRatings";

export interface ConfidenceChainEcho {
  handle: ConfidenceChainBlindHandle;
  exposureId: string;
}

/** Run after the browser has painted the current frame: two animation
 *  frames, so the receipt follows a paint and never precedes it. */
function afterPaint(run: () => void): void {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => window.requestAnimationFrame(run));
    return;
  }
  setTimeout(run, 0);
}

function renderInstanceId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

/** The echo for the moment on screen: null until the chain's packet has
 *  been painted and receipted, then the handle and its exposure id. */
export function useConfidenceChainReceipt(
  snippetId: string,
  painted: boolean,
): { readonly current: ConfidenceChainEcho | null } {
  const echo = useRef<ConfidenceChainEcho | null>(null);
  useEffect(() => {
    echo.current = null;
    if (!painted || !snippetId) return;
    let cancelled = false;
    const instance = renderInstanceId();
    void prepareConfidenceChainPacket(snippetId).then((handle) => {
      if (cancelled || !handle) return;
      afterPaint(() => {
        if (cancelled) return;
        void acknowledgeConfidenceChainRender(handle, {
          renderInstanceId: instance,
          clientRenderedAt: new Date().toISOString(),
          idempotencyKey: `coach-walk-visible-render:${handle.presentationId}:${instance}`,
        }).then((result) => {
          if (!cancelled && result.ok) {
            echo.current = { handle, exposureId: result.receipt.exposureId };
          }
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [snippetId, painted]);
  return echo;
}
