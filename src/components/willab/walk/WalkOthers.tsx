"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { CHUNK_SHEET_COPY as COPY, ONE_THING_COPY, WALK_COPY } from "../idealEditCopy";
import { WALK_ANSWER_HOLD_MS } from "@/lib/willab/walkMotion";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import WalkOverlay from "./WalkOverlay";
import WalkMessage from "./WalkMessage";
import WalkPlayer from "./WalkPlayer";
import WalkFooter from "./WalkFooter";
import WalkLoading from "./WalkLoading";
import WalkFaces, { WalkUnclear } from "./WalkFaces";
import { WalkSpeakerBubble, WalkThreadMark, landingWelcome, useMountedAsPast, useWalkPart } from "./WalkThread";
import { answerOtherClip, fetchOtherAnswers, fetchOtherClips, type OtherClip } from "@/services/api/otherSpeakers";
import { othersBridge, othersChat, othersOneSaid, type OthersLevel } from "@/lib/willab/walkThread";

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
/*  Once the walk moves on, the moments and the answers stay in the thread    */
/*  (B5); with nobody to judge, the step leaves nothing there.                */
/*                                                                            */
/*  In a walk played again (founder 2026-10-28, N247): the moments judged in  */
/*  this walk, each with its answer, all at once, and Next. It reads only     */
/*  those answers, also drawn as an earlier or later part; the queue is      */
/*  never asked and nothing is posted. None judged, it is passed by.          */
/*                                                                            */
/*  THE ONE THING WALK (founder 2026-10-31, N309 item 2, N300): from Take 2,  */
/*  ONE moment, right after the speaker's own try, its machine level the     */
/*  walk's turn (high, middle, low across Takes, `level`). "Let's see how    */
/*  you find this voice. It helps us understand you and serve you better.",  */
/*  then the clip and "Does this sound confident to you?" in one bubble (no  */
/*  Line B), the faces and "Audio unclear" as ever, the answer as the        */
/*  speaker's own reply "{face} {answer} ✓", then "Got it.". Each lands on    */
/*  its own, the grey ones behind the typing dots (B7, N440 item 1): the      */
/*  chosen card fills and holds 0.28 s, then the answer and "Got it." land,   */
/*  and the walk moves on once they have (J5, the prototype's judge()).       */
/* -------------------------------------------------------------------------- */

type Loaded = { clips: OtherClip[]; given: Record<string, ConfidenceRatingValue> };

/** The One thing walk's answer and "Got it." land in well under this; a
 *  landing that never says it has moves the walk on all the same. */
const LANDED_WITHIN_MS = 2000;

/** What the screen shows: the answers already given in this walk, oldest
 *  first (`judged` of them, at most three), else the Take's queue to judge,
 *  as many as the server sends, at most three. */
async function load(judged: number, take: string | null, level: OthersLevel | null): Promise<Loaded> {
  const most = level ? 1 : 3;
  const answered = await loadGiven(judged, most);
  if (answered.clips.length > 0) return answered;
  const list = level ? await fetchOtherClips(take, level) : await fetchOtherClips(take);
  return { clips: list.slice(0, most), given: {} };
}

/** The answers already given in this walk, oldest first (`judged` of them,
 *  at most `most`); none: nothing. */
async function loadGiven(judged: number, most = 3): Promise<Loaded> {
  if (judged <= 0) return { clips: [], given: {} };
  const answers = (await fetchOtherAnswers()).slice(0, Math.min(most, judged)).reverse();
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
  level = null,
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
   *  drawn from it. `one`: the One thing walk's one moment (N309). */
  onChat?: (at: number, of: number, from: string | null, answer: ConfidenceRatingValue | null, one?: boolean) => void;
  /** The One thing walk's one moment, of this machine level (N309 item 2):
   *  its own words, one clip. Null: the Take's three (N119). */
  level?: OthersLevel | null;
}) {
  const one = level !== null;
  const [clips, setClips] = useState<OtherClip[] | null>(null);
  const [at, setAt] = useState(0);
  const [given, setGiven] = useState<Record<string, ConfidenceRatingValue>>({});
  // The answers came in with the clips: seen again, not given now.
  const [reopened, setReopened] = useState(false);
  // Nobody to judge (a replay, or none sent): the walk went on, and the
  // step leaves nothing in the thread, not its typing dots (B5).
  const [none, setNone] = useState(false);
  const past = useMountedAsPast();
  // The One thing walk's answer and "Got it.", once the chosen card has
  // held (J5); whether the part lands its bubbles one by one, as its
  // overlay decides at its first draw; and where those two are in their
  // landing, so the walk moves on only once they have landed.
  const [heard, setHeard] = useState(false);
  const part = useWalkPart();
  const [lands] = useState(() => part?.now === true && part.fresh && landingWelcome());
  const landing = useRef<"drawn" | "landing" | null>(null);
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
      setNone(true);
      if (!past) done.current();
      return;
    }
    let live = true;
    void (replay ? loadGiven(judgedAtOpen.current, one ? 1 : 3) : load(judgedAtOpen.current, take, level)).then((loaded) => {
      if (!live) return;
      if (loaded.clips.length === 0) {
        setNone(true);
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
  }, [past, skip, take, replay, level, one]);

  const clip = clips?.[at];
  const answered = clip ? given[clip.id] ?? null : null;
  // "Only my community": the bridge and the top bar name it (section 9).
  const from = clips?.[0]?.community ?? null;
  const bridge = clips ? othersBridge(clips.length, from) : "";
  const chat = useRef(onChat);
  chat.current = onChat;
  useEffect(() => {
    if (past || reopened) return; // the chat already holds these
    if (clips && at < clips.length) chat.current?.(at, clips.length, clips[0]?.community ?? null, null, one);
  }, [clips, at, reopened, past, one]);
  const forward = () => (clips && at + 1 < clips.length ? setAt(at + 1) : onDone());
  /** "Other speakers · 2 of 3", or the community's name. */
  const where = (i: number) => `${from ?? WALK_COPY.othersTitle} · ${i + 1} ${COPY.pagerOf} ${clips?.length ?? 1}`;

  /** The One thing walk's answer and "Got it." are drawn in; they land
   *  (the speaker's own bubble's beat, then the dots before the grey one),
   *  then the walk moves on. Where nothing lands one by one, at once. */
  const moveOn = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    landing.current = null;
    forward();
  };
  const land = () => {
    setHeard(true);
    if (!lands) return forward();
    landing.current = "drawn";
    timer.current = window.setTimeout(() => landing.current && moveOn(), LANDED_WITHIN_MS);
  };
  const settled = (landed: boolean) => {
    if (!landed && landing.current === "drawn") landing.current = "landing";
    else if (landed && landing.current === "landing") moveOn();
  };
  const pick = (value: ConfidenceRatingValue) => {
    if (!clip || answered !== null) return;
    setGiven((g) => ({ ...g, [clip.id]: value }));
    void answerOtherClip(clip.id, value);
    onChat?.(at, clips?.length ?? 1, from, value, one);
    timer.current = window.setTimeout(one ? land : forward, holdMs);
  };

  if ((past && !replay) || none) return null;
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
  if (one) {
    // Its own keyed bubbles, so each lands on its own (B7): one Fragment
    // was one item, drawn in at once in the dots' place.
    const said = clip && answered !== null && (heard || reopened) ? othersOneSaid(answered) : null;
    return (
      <WalkOverlay testId={testId} onClose={onClose} footer={footer} onSettled={settled}>
        {!clips || !clip
          ? [<WalkLoading key="loading" />]
          : [
              <WalkThreadMark key="mark" label={from ?? WALK_COPY.othersTitle} quiet />,
              <WalkMessage key="intro">
                <span data-walk-judge-intro>{ONE_THING_COPY.judgeIntro}</span>
              </WalkMessage>,
              <WalkMessage key="clip" wide>
                <div className="mb-2.5">
                  <WalkPlayer
                    look="bare"
                    seed={`other-${clip.id}`}
                    src={clip.src}
                    startOffsetMs={clip.startOffsetMs}
                    durationMs={clip.durationMs}
                    label={from ?? WALK_COPY.othersTitle}
                  />
                </div>
                <span>{COPY.confidenceQuestion}</span>
              </WalkMessage>,
              ...(said
                ? [
                    <WalkSpeakerBubble key="answer">{said}</WalkSpeakerBubble>,
                    <WalkMessage key="got">
                      <span data-walk-got-it>{ONE_THING_COPY.gotIt}</span>
                    </WalkMessage>,
                  ]
                : []),
            ]}
      </WalkOverlay>
    );
  }
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
