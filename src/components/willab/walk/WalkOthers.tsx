"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import { WALK_ANSWER_HOLD_MS } from "@/lib/willab/walkMotion";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import WalkOverlay from "./WalkOverlay";
import WalkMessage from "./WalkMessage";
import WalkPlayer from "./WalkPlayer";
import WalkFooter from "./WalkFooter";
import WalkLoading from "./WalkLoading";
import WalkFaces, { WalkUnclear } from "./WalkFaces";
import { WalkSpeakerBubble, WalkThreadMark, useMountedAsPast } from "./WalkThread";
import { answerOtherClip, fetchOtherAnswers, fetchOtherClips, type OtherClip } from "@/services/api/otherSpeakers";
import { othersBridge, othersChat } from "@/lib/willab/walkThread";

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
/*                                                                            */
/*  In the walk's chat (founder 2026-10-20, WIL-89): each moment lands under  */
/*  the one before with its name ("Other speakers · 2 of 3"), the answer as   */
/*  the speaker's own bubble ("👍 Yes"); the three cards and "Audio unclear"  */
/*  are the dock. First drawn as an earlier part, it asks and posts nothing. */
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
  const past = useMountedAsPast();
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
    if (past) return;
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
  }, [past, skip, count, judged]);

  const clip = clips?.[at];
  const answered = clip ? given[clip.id] ?? null : null;
  // "Only my community": the bridge and the top bar name it (section 9).
  const from = clips?.[0]?.community ?? null;
  const bridge = clips ? othersBridge(clips.length, from) : "";
  const chat = useRef(onChat);
  chat.current = onChat;
  useEffect(() => {
    if (past || reopened) return; // the chat already holds these
    if (clips && at < clips.length) chat.current?.(at, clips.length, clips[0]?.community ?? null, null);
  }, [clips, at, reopened, past]);
  const forward = () => (clips && at + 1 < clips.length ? setAt(at + 1) : onDone());
  /** "Other speakers · 2 of 3", or the community's name. */
  const where = (i: number) => `${from ?? WALK_COPY.othersTitle} · ${i + 1} ${COPY.pagerOf} ${clips?.length ?? 1}`;

  const pick = (value: ConfidenceRatingValue) => {
    if (!clip || answered !== null) return;
    setGiven((g) => ({ ...g, [clip.id]: value }));
    void answerOtherClip(clip.id, value);
    onChat?.(at, clips?.length ?? 1, from, value);
    timer.current = window.setTimeout(forward, holdMs);
  };

  if (past) return null;
  const footer = !clip ? null : reopened && answered !== null ? (
    // Answered: the answer is the speaker's bubble above, Next alone under it
    // ("✓ Practised" is the one ✓ line, founder 2026-10-21).
    <WalkFooter pill={{ label: COPY.pagerNext, onClick: forward, testId: "walk-forward" }} />
  ) : (
    <WalkFooter>
      <WalkFaces answered={answered} given={reopened} onPick={pick} />
      {answered === null ? <WalkUnclear onPick={() => pick("audio_unclear")} /> : null}
    </WalkFooter>
  );
  return (
    <WalkOverlay testId={testId} onClose={onClose} footer={footer}>
      {!clips || !clip ? (
        <WalkLoading />
      ) : (
        clips.slice(0, at + 1).map((shown, i) => {
          const said = given[shown.id] ? othersChat(i, clips.length, from, given[shown.id])?.body : null;
          return (
            <Fragment key={shown.id}>
              <WalkThreadMark label={where(i)} />
              <WalkMessage wide>
                {i === 0 ? <span>{bridge}</span> : null}
                <div className="my-2.5">
                  <WalkPlayer
                    look="bare"
                    seed={`other-${shown.id}`}
                    src={shown.src}
                    startOffsetMs={shown.startOffsetMs}
                    durationMs={shown.durationMs}
                    label={where(i)}
                  />
                </div>
                <span>{COPY.confidenceQuestion}</span>
              </WalkMessage>
              {said ? <WalkSpeakerBubble>{said}</WalkSpeakerBubble> : null}
            </Fragment>
          );
        })
      )}
    </WalkOverlay>
  );
}
