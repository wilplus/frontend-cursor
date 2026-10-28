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
/*  The Take's moments, up to three: one the machine reads high, one middle  */
/*  and one low, three speakers, fixed for the Take (founder 2026-10-23,      */
/*  N119; until then one per try). None to judge, the walk goes on. The      */
/*  bridge line, the clip and the question in one grey bubble;               */
/*  three full-width tall cards, 👍 Yes · 😐 In-between · 👎 No, and "Audio    */
/*  unclear" as a small grey link. An answer fills the card's edge black,     */
/*  holds 0.28 s and moves on; it stays locked once given, and the step       */
/*  reopened shows "✓ Answered" and "Next". Audio only, no number (AC-9).     */
/*                                                                            */
/*  Reopened from the Lounge (founder 2026-10-18): the moments the speaker    */
/*  already judged in this walk, as many as the chat holds their answers      */
/*  (`judged`), each with the answer they gave, its card orange, "✓ Answered" */
/*  over Next. Nothing is asked again and nothing is posted; with no answer   */
/*  kept, the queue is asked afresh as before. The count is read once, when   */
/*  the step opens: the chat counts each answer given here at once, and a    */
/*  live answer never loads the step again (it then stood on a moment it no   */
/*  longer held, the typing dots for good; 2026-10-27).                      */
/*                                                                            */
/*  In the walk's chat (founder 2026-10-20, WIL-89): each moment lands under  */
/*  the one before with its name ("Other speakers · 2 of 3"), the answer as   */
/*  the speaker's own bubble ("👍 Yes"); the three cards and "Audio unclear"  */
/*  are the dock. First drawn as an earlier part, it asks and posts nothing. */
/*                                                                            */
/*  In a walk played again (founder 2026-10-28, N247): the moments judged in  */
/*  this walk, each with its answer, all at once, and Next. It reads only     */
/*  those answers, also drawn as an earlier or later part; the queue is      */
/*  never asked and nothing is posted. None judged, it is passed by.          */
/* -------------------------------------------------------------------------- */

type Loaded = { clips: OtherClip[]; given: Record<string, ConfidenceRatingValue> };

/** What the screen shows: the answers already given in this walk, oldest
 *  first (`judged` of them, at most three), else the Take's queue to judge,
 *  as many as the server sends, at most three. */
async function load(judged: number, take: string | null): Promise<Loaded> {
  const answered = await loadGiven(judged);
  if (answered.clips.length > 0) return answered;
  const list = await fetchOtherClips(take);
  return { clips: list.slice(0, 3), given: {} };
}

/** The answers already given in this walk, oldest first (`judged` of them,
 *  at most three); none: nothing. */
async function loadGiven(judged: number): Promise<Loaded> {
  if (judged <= 0) return { clips: [], given: {} };
  const answers = (await fetchOtherAnswers()).slice(0, Math.min(3, judged)).reverse();
  return { clips: answers, given: Object.fromEntries(answers.map((a) => [a.id, a.answer])) };
}

export default function WalkOthers({
  testId,
  take = null,
  judged = 0,
  replay = false,
  skip,
  onDone,
  onClose,
  holdMs = WALK_ANSWER_HOLD_MS,
  onChat,
}: {
  testId?: string;
  /** The Take whose walk this is: the server's set for it (N119). */
  take?: string | null;
  /** How many the speaker already judged in this walk (the chat's count):
   *  reopened, those are shown answered. */
  judged?: number;
  /** A walk played again: the answers given, read only (N247). */
  replay?: boolean;
  /** A guest, or a replay with nothing judged, judges nobody. */
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
  // As many as the chat held when the step opened, never the live count.
  const judgedAtOpen = useRef(judged);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    if (past && !replay) return;
    if (skip) {
      if (!past) done.current();
      return;
    }
    let live = true;
    void (replay ? loadGiven(judgedAtOpen.current) : load(judgedAtOpen.current, take)).then((loaded) => {
      if (!live) return;
      if (loaded.clips.length === 0) {
        if (!past) done.current();
        return;
      }
      setGiven(loaded.given);
      setReopened(Object.keys(loaded.given).length > 0);
      setClips(loaded.clips);
      // Played again, every moment judged is there at once.
      if (replay) setAt(loaded.clips.length - 1);
    });
    return () => {
      live = false;
    };
  }, [past, skip, take, replay]);

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

  if (past && !replay) return null;
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
