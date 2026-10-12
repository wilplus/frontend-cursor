"use client";

import { useEffect, useRef, useState } from "react";
import { CHUNK_SHEET_COPY as COPY } from "../idealEditCopy";
import WalkOverlay, { type WalkNav } from "./WalkOverlay";
import WalkMessage from "./WalkMessage";
import WalkFooter from "./WalkFooter";
import WalkLoading from "./WalkLoading";

/* -------------------------------------------------------------------------- */
/*  WalkSummary — the closing summary, the walk's last lens step (founder      */
/*  lock 2026-10-12, moment and feedback chat, sections 2.7 and 3).            */
/*                                                                            */
/*  The top bar reads "Take N". While the words are fetched the breathing     */
/*  mark shows; then one grey bubble with the summary and "Next", which       */
/*  closes the walk onto the Ideal Text. A failed fetch skips the step.       */
/* -------------------------------------------------------------------------- */

export default function WalkSummary({
  testId,
  takeIndex,
  fetchText,
  onBack,
  backDisabled,
  onNext,
  onClose,
}: {
  testId?: string;
  takeIndex: number | null;
  /** The summary's words; null: none, the step is skipped. */
  fetchText: (() => Promise<string | null>) | null;
  onBack: () => void;
  backDisabled: boolean;
  onNext: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const next = useRef(onNext);
  next.current = onNext;
  useEffect(() => {
    if (!fetchText) {
      next.current();
      return;
    }
    let live = true;
    void fetchText().then((words) => {
      if (!live) return;
      if (words) setText(words);
      else next.current();
    });
    return () => {
      live = false;
    };
  }, [fetchText]);

  const nav: WalkNav = {
    position: takeIndex != null ? `${COPY.historyTake} ${takeIndex}` : COPY.historyTake,
    index: 0,
    total: 1,
    onBack,
    onNext,
    backDisabled,
    nextDisabled: true,
  };
  return (
    <WalkOverlay
      testId={testId}
      nav={nav}
      onClose={onClose}
      footer={text ? <WalkFooter pill={{ label: COPY.pagerNext, onClick: onNext, testId: "walk-forward" }} /> : null}
    >
      {text ? (
        <WalkMessage>
          <span>{text}</span>
        </WalkMessage>
      ) : (
        <WalkLoading />
      )}
    </WalkOverlay>
  );
}
