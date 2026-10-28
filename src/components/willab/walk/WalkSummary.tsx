"use client";

import { useEffect, useRef, useState } from "react";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import WalkOverlay, { type WalkNav } from "./WalkOverlay";
import WalkMessage from "./WalkMessage";
import WalkFooter from "./WalkFooter";
import WalkLoading from "./WalkLoading";
import { WalkEdited, useMountedAsPast } from "./WalkThread";

/* -------------------------------------------------------------------------- */
/*  WalkSummary — the closing summary, the walk's last lens step (founder      */
/*  lock 2026-10-12, moment and feedback chat, sections 2.7 and 3).            */
/*                                                                            */
/*  The top bar reads "Take N". While the words are fetched the typing dots   */
/*  show; then one grey bubble with the summary and "Next", which             */
/*  closes the walk onto the Ideal Text. A failed fetch skips the step.       */
/*  First drawn as an earlier part of the walk's chat (the leaving copy), it  */
/*  fetches nothing (founder 2026-10-20).                                     */
/*                                                                            */
/*  The summary lives in the walk only (founder 2026-10-26, N192, D4): the    */
/*  chat holds it but no longer draws it, so the walk shows it as the chat    */
/*  holds it (`stored`), at once and in a walk played again. A coach's note   */
/*  that rewrote it marks it "Edited" (B13), with "Updated with your coach's  */
/*  note · see / hide the earlier version" under it, as the chat's bubble had */
/*  it (D5).                                                                  */
/* -------------------------------------------------------------------------- */

/** The summary as the chat holds it: its words, and the words before a
 *  coach's note rewrote them (null: never rewritten). */
export type WalkStoredSummary = { text: string; earlier: string | null };

export default function WalkSummary({
  testId,
  takeIndex,
  fetchText,
  stored = null,
  onBack,
  backDisabled,
  onNext,
  onClose,
}: {
  testId?: string;
  takeIndex: number | null;
  /** The summary's words; null: none, the step is skipped. */
  fetchText: (() => Promise<string | null>) | null;
  /** The summary as the chat holds it; shown without a fetch. */
  stored?: WalkStoredSummary | null;
  onBack: () => void;
  backDisabled: boolean;
  onNext: () => void;
  onClose: () => void;
}) {
  const [fetched, setFetched] = useState<string | null>(null);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const text = stored?.text ?? fetched;
  const earlier = stored?.earlier ?? null;
  const past = useMountedAsPast();
  const held = stored !== null;
  const next = useRef(onNext);
  next.current = onNext;
  useEffect(() => {
    if (past || held) return;
    if (!fetchText) {
      next.current();
      return;
    }
    let live = true;
    void fetchText().then((words) => {
      if (!live) return;
      if (words) setFetched(words);
      else next.current();
    });
    return () => {
      live = false;
    };
  }, [fetchText, past, held]);

  const nav: WalkNav = {
    position: takeIndex != null ? `${COPY.historyTake} ${takeIndex}` : COPY.historyTake,
    index: 0,
    total: 1,
    onBack,
    onNext,
    backDisabled,
    nextDisabled: true,
  };
  if (past && !text) return null;
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
          {earlier ? (
            <>
              <WalkEdited />
              <button
                type="button"
                onClick={() => setEarlierOpen((open) => !open)}
                className="mt-1 block text-left text-[14px] text-muted-foreground underline underline-offset-[3px]"
              >
                {earlierOpen ? WALK_COPY.summaryHideEarlier : WALK_COPY.summarySeeEarlier}
              </button>
              {earlierOpen ? (
                <span className="mt-1 block border-t border-border pt-2 text-[16px] text-muted-foreground">{earlier}</span>
              ) : null}
            </>
          ) : null}
        </WalkMessage>
      ) : (
        <WalkLoading />
      )}
    </WalkOverlay>
  );
}
