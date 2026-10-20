"use client";

import { useEffect, useRef, useState } from "react";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import { WALK_ANSWER_HOLD_MS } from "@/lib/willab/walkMotion";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import WalkOverlay from "./WalkOverlay";
import WalkMessage from "./WalkMessage";
import WalkPlayer from "./WalkPlayer";
import WalkFooter from "./WalkFooter";
import WalkLoading from "./WalkLoading";
import WalkFaces, { WalkUnclear } from "./WalkFaces";
import { answerOtherClip, fetchOtherAnswers, fetchOtherClips, type OtherClip } from "@/services/api/otherSpeakers";
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
/*                                                                            */
/*  Reopened from the Lounge (founder 2026-10-18): the moments the speaker    */
/*  already judged in this walk, as many as the chat holds their answers      */
/*  (`judged`), each with the answer they gave, its card orange, "✓ Answered" */
/*  over Next. Nothing is asked again and nothing is posted; with no answer   */
/*  kept, the queue is asked afresh as before.                                */
/* -------------------------------------------------------------------------- */

type Loaded = { clips: OtherClip[]; given: Record<string, ConfidenceRatingValue> };

/** What the screen shows: the answers already given in this walk, oldest
 *  first (`judged` of them, at most three), else the queue to judge. */
async function load(judged: number, count: number): Promise<Loaded> {
  if (judged > 0) {
    const answers = (await fetchOtherAnswers()).slice(0, Math.min(3, judged)).reverse();
    if (answers.length > 0) {
      return { clips: answers, given: Object.fromEntries(answers.map((a) => [a.id, a.answer])) };
    }
  }
  const list = await fetchOtherClips();
  return { clips: list.slice(0, Math.max(1, Math.min(3, count))), given: {} };
}

export default function WalkOthers({
  testId,
  count,
  judged = 0,
  skip,
  onDone,
  onClose,
  holdMs = WALK_ANSWER_HOLD_MS,
  onChat,
}: {
  testId?: string;
  /** How many to judge: one per practise try, 1 to 3. */
  count: number;
  /** How many the speaker already judged in this walk (the chat's count):
   *  reopened, those are shown answered. */
  judged?: number;
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
  // The answers came in with the clips: seen again, not given now.
  const [reopened, setReopened] = useState(false);
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
    void load(judged, count).then((loaded) => {
      if (!live) return;
      if (loaded.clips.length === 0) {
        done.current();
        return;
      }
      setGiven(loaded.given);
      setReopened(Object.keys(loaded.given).length > 0);
      setClips(loaded.clips);
    });
    return () => {
      live = false;
    };
  }, [skip, count, judged]);

  const clip = clips?.[at];
  const answered = clip ? given[clip.id] ?? null : null;
  // "Only my community": the bridge and the top bar name it (section 9).
  const from = clips?.[0]?.community ?? null;
  const bridge = clips ? othersBridge(clips.length, from) : "";
  const chat = useRef(onChat);
  chat.current = onChat;
  useEffect(() => {
    if (reopened) return; // the chat already holds these
    if (clips && at < clips.length) chat.current?.(at, clips.length, clips[0]?.community ?? null, null);
  }, [clips, at, reopened]);
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
          <WalkFaces answered={answered} given={reopened} onPick={pick} />
          {answered === null ? <WalkUnclear onPick={() => pick("audio_unclear")} /> : null}
        </>
      )}
    </WalkOverlay>
  );
}
