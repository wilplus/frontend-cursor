"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import { WALK_ANSWER_HOLD_MS } from "@/lib/willab/walkMotion";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import WalkOverlay from "./WalkOverlay";
import WalkMessage from "./WalkMessage";
import WalkPlayer from "./WalkPlayer";
import WalkFooter from "./WalkFooter";
import WalkLoading from "./WalkLoading";
import { answerOtherClip, fetchOtherClips, type OtherClip } from "@/services/api/otherSpeakers";
import { othersBridge } from "@/lib/willab/walkThread";

/* -------------------------------------------------------------------------- */
/*  WalkOthers — judge other speakers, once, after practice (founder lock      */
/*  2026-10-12, moment and feedback chat, section 2.6; prototype v31 `judge`). */
/*                                                                            */
/*  One moment per try, at least 1 and at most 3; none to judge, the walk     */
/*  goes on. The bridge line, the clip and the question in one grey bubble;   */
/*  three full-width tall cards, 👍 Yes · 😐 In-between · 👎 No, and "Audio    */
/*  unclear" as a small grey link. An answer fills the card's edge black,     */
/*  holds 0.28 s and moves on; it stays locked once given, and the step       */
/*  reopened shows "✓ Answered" and "Next". Audio only, no number (AC-9).     */
/* -------------------------------------------------------------------------- */

const FACES: readonly { value: ConfidenceRatingValue; face: string; label: string }[] = [
  { value: "yes", face: "👍", label: WALK_COPY.judgeYes },
  { value: "in_between", face: "😐", label: WALK_COPY.judgeInBetween },
  { value: "no", face: "👎", label: WALK_COPY.judgeNo },
];

export default function WalkOthers({
  testId,
  count,
  skip,
  onDone,
  onClose,
  holdMs = WALK_ANSWER_HOLD_MS,
  onChat,
}: {
  testId?: string;
  /** How many to judge: one per practise try, 1 to 3. */
  count: number;
  /** A guest or a replay judges nobody. */
  skip: boolean;
  onDone: () => void;
  onClose: () => void;
  holdMs?: number;
  /** A moment shown (`answer` null) or answered, for the chat. Nothing is
   *  drawn from it. */
  onChat?: (at: number, of: number, from: string | null, answer: ConfidenceRatingValue | null) => void;
}) {
  const [clips, setClips] = useState<OtherClip[] | null>(null);
  const [at, setAt] = useState(0);
  const [given, setGiven] = useState<Record<string, ConfidenceRatingValue>>({});
  const done = useRef(onDone);
  done.current = onDone;
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    if (skip) {
      done.current();
      return;
    }
    let live = true;
    void fetchOtherClips().then((list) => {
      if (!live) return;
      const mine = list.slice(0, Math.max(1, Math.min(3, count)));
      if (mine.length === 0) done.current();
      else setClips(mine);
    });
    return () => {
      live = false;
    };
  }, [skip, count]);

  const clip = clips?.[at];
  const answered = clip ? given[clip.id] ?? null : null;
  // "Only my community": the bridge and the top bar name it (section 9).
  const from = clips?.[0]?.community ?? null;
  const bridge = clips ? othersBridge(clips.length, from) : "";
  const chat = useRef(onChat);
  chat.current = onChat;
  useEffect(() => {
    if (clips && at < clips.length) chat.current?.(at, clips.length, clips[0]?.community ?? null, null);
  }, [clips, at]);
  const forward = () => (clips && at + 1 < clips.length ? setAt(at + 1) : onDone());
  const nav = clips
    ? {
        position: `${from ?? WALK_COPY.othersTitle} · ${at + 1} ${COPY.pagerOf} ${clips.length}`,
        index: at,
        total: clips.length,
        onBack: () => setAt((i) => Math.max(0, i - 1)),
        onNext: forward,
        backDisabled: at === 0,
        nextDisabled: answered === null,
      }
    : undefined;

  const pick = (value: ConfidenceRatingValue) => {
    if (!clip || answered !== null) return;
    setGiven((g) => ({ ...g, [clip.id]: value }));
    void answerOtherClip(clip.id, value);
    onChat?.(at, clips?.length ?? 1, from, value);
    timer.current = window.setTimeout(forward, holdMs);
  };

  return (
    <WalkOverlay
      testId={testId}
      nav={nav}
      onClose={onClose}
      footer={
        answered !== null ? (
          <WalkFooter pill={{ label: COPY.pagerNext, onClick: forward, testId: "walk-forward" }}>
            <p className="m-0 text-center text-[13px] text-muted-foreground">{WALK_COPY.answered}</p>
          </WalkFooter>
        ) : null
      }
    >
      {!clips || !clip ? (
        <WalkLoading />
      ) : (
        <>
          <WalkMessage wide>
            {at === 0 ? <span>{bridge}</span> : null}
            <div className="my-2.5">
              <WalkPlayer
                key={clip.id}
                look="bare"
                seed={`other-${clip.id}`}
                src={clip.src}
                startOffsetMs={clip.startOffsetMs}
                durationMs={clip.durationMs}
                label={nav?.position ?? WALK_COPY.othersTitle}
              />
            </div>
            <span>{COPY.confidenceQuestion}</span>
          </WalkMessage>
          <div data-walk-judgement className="flex min-h-0 flex-1 flex-col gap-2.5">
            {FACES.map((o) => {
              const on = answered === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  data-walk-answer={o.value}
                  aria-pressed={on}
                  disabled={answered !== null}
                  onClick={() => pick(o.value)}
                  className={cn(
                    "walk-press walk-fill flex max-h-[120px] min-h-[72px] flex-1 items-center gap-[18px] rounded-2xl border-[1.5px] bg-background px-[22px] text-left text-[21px] font-semibold text-foreground",
                    on ? "border-foreground" : "border-border",
                    answered !== null && !on && "opacity-35",
                  )}
                >
                  <span aria-hidden="true" className="text-[36px] leading-none">
                    {o.face}
                  </span>
                  {o.label}
                </button>
              );
            })}
          </div>
          {answered === null ? (
            <button
              type="button"
              data-walk-answer="audio_unclear"
              onClick={() => pick("audio_unclear")}
              className="walk-press flex h-[34px] w-full items-center justify-center text-[14px] text-muted-foreground"
            >
              {WALK_COPY.judgeUnclear}
            </button>
          ) : null}
        </>
      )}
    </WalkOverlay>
  );
}
