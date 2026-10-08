"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FeedbackWalk, {
  type FeedbackWalkHelperWords,
  type FeedbackWalkPractiseWords,
  type FeedbackWalkRequest,
} from "@/components/willab/walk/FeedbackWalk";
import { walkPractiseIO, type WalkPractiseSource } from "@/services/api/walkPractise";
import type { ConfidentVoicePracticeOffer } from "@/services/api/idealText";
import WalkEndSheet from "@/components/willab/walk/WalkEndSheet";
import { useWalkJournalPost } from "@/components/willab/useWalkJournalPost";
import GuestSignUpDialog from "@/components/willab/GuestSignUpDialog";
import { CHUNK_SHEET_COPY as COPY } from "@/components/willab/idealEditCopy";
import {
  buildFeedbackWalk,
  walkStart,
  type FeedbackWalkItem,
} from "@/lib/willab/feedbackWalkModel";
import PageStandIn from "./pageStandIn";
import {
  COACH_NOTE,
  MOMENTS,
  PAGE_WORDS,
  PARAGRAPHS,
  SLIDE_LABEL,
  TAKE_SHOWN,
  makeToneUrl,
  type Moment,
  type Piece,
} from "./walkFixtures";

/* -------------------------------------------------------------------------- */
/*  /dev/feedback-walk?live=1 — the PRODUCTION walk (FeedbackWalk, build plan  */
/*  D-FW-14) on the harness's fixtures, so the screenshot harness (X7) draws  */
/*  the coach's note, the praise, the helper words and the clearer version    */
/*  (D-FW-15) from the component the page mounts, not from the harness's own  */
/*  copy of them. DEV ONLY: page.tsx renders nothing in production.           */
/*                                                                            */
/*  The clearer version is handed over as the page hands a served rewrite:    */
/*  the words said and the words offered, whole (the fixture's pieces joined);*/
/*  the walk finds what changed. A decision is only noted on the harness.     */
/*                                                                            */
/*  It opens on the walk's first screen, as "Review feedback" does; the page  */
/*  stand-in's own button opens it again. &guest=1 draws it for a guest: a    */
/*  pick opens the sign-up dialog and nothing is saved.                       */
/*                                                                            */
/*  The practise (D-FW-16) runs through the app's own clients and BFF routes  */
/*  (walkPractiseIO) on a stand-in snippet: nothing answers them here, so a   */
/*  try is read as late (O5) unless the browser answers the routes, as        */
/*  e2e/feedback-walk-practise.spec.mjs and the screenshot manifest do.       */
/*                                                                            */
/*  The exercise (D-FW-17) is handed over as the page hands a served offer:   */
/*  the coach's video (the harness's dark box), the instruction and the       */
/*  words. &exvideo=0 hands it with no video: the walk goes straight to the   */
/*  practise (Q-B15 A).                                                       */
/*                                                                            */
/*  "Judgement time!" and the judgements (D-FW-18): every moment carries its  */
/*  Confident Voice item to judge; an answer or a Skip is only noted on the   */
/*  harness. The Journal post is read through the app's own client and BFF    */
/*  route (useWalkJournalPost): nothing answers it here, so the link is       */
/*  hidden unless the browser answers the route, as the e2e spec and the      */
/*  screenshot manifest do.                                                   */
/* -------------------------------------------------------------------------- */

/** No network, no file: the dark box with its play button. */
const NO_VIDEO = "data:video/mp4;base64,";

function openCardOf(m: Moment): FeedbackWalkItem["openCard"] {
  if (m.praise) return "praise";
  if (m.clearer) return "rewrite";
  if (m.exercise) return "exercise";
  return null;
}

const joined = (pieces: readonly Piece[]) => pieces.map((p) => p.text).join("");

/** A served rewrite as the walk receives it: the quote and the proposal. */
function rewriteOf(m: Moment): FeedbackWalkItem<string>["rewrite"] {
  if (!m.clearer) return null;
  return { quote: joined(m.clearer.before), proposedText: joined(m.clearer.after), item: `rewrite-${m.index}` };
}

/** A served exercise as the walk receives it: the coach's, with its video
 *  unless `video` is false. */
function exerciseOf(m: Moment, video: boolean): FeedbackWalkItem<string>["exercise"] {
  if (!m.exercise) return null;
  return {
    video: video ? NO_VIDEO : null,
    byCoach: true,
    instruction: m.exercise.instruction,
    say: PARAGRAPHS[m.index],
    item: `exercise-${m.index}`,
  };
}

/** The stand-in exercise offer the practise is opened on. */
const EXERCISE_OFFER: ConfidentVoicePracticeOffer = {
  exerciseId: "harness-exercise",
  version: 1,
  title: "",
  instruction: "",
  introduction: "",
  yesIntroduction: "",
  noIntroduction: "",
  explanationVideoRef: "",
  passage: PARAGRAPHS[3],
  practiceId: null,
  resume: false,
  doneBefore: false,
  chosenByCoach: true,
};

/** The fixtures as the page hands them to the walk: one item per moment. */
function liveItems(audioSrc: string, exerciseVideo: boolean): FeedbackWalkItem<string>[] {
  return MOMENTS.map((m) => ({
    start: m.index * 100,
    slide: 1,
    blockId: `block-${m.index}`,
    openCard: openCardOf(m),
    partId: `part-${m.index}`,
    paragraphText: PARAGRAPHS[m.index],
    slideLabel: SLIDE_LABEL,
    praiseWords: m.praise ? [m.praise.text] : null,
    clip: { src: audioSrc, startOffsetMs: 0, durationMs: m.durationMs },
    rewrite: rewriteOf(m),
    item: m.clearer ? `rewrite-${m.index}` : null,
    exercise: exerciseOf(m, exerciseVideo),
    judge: `cv-${m.index}`,
  }));
}

function useToneSrc() {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = makeToneUrl();
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, []);
  return src;
}

/** The stand-in snippet every harness moment is practised on. */
const PRACTISE_SOURCE: WalkPractiseSource = {
  snippetId: "00000000-0000-4000-8000-00000000c1a1",
  evidence: { projectId: "harness-project", takeSessionId: "harness-take", slideIndex: 1, paragraphIndex: 1, start: 0, end: 10 },
  feedbackId: null,
};

export default function LiveWalk({
  guest,
  practiceOn,
  exerciseVideo = true,
}: {
  guest: boolean;
  practiceOn: boolean;
  exerciseVideo?: boolean;
}) {
  const audioSrc = useToneSrc();
  const model = useMemo(
    () =>
      buildFeedbackWalk({
        items: audioSrc ? liveItems(audioSrc, exerciseVideo) : [],
        coachNote: true,
        practiceOn,
        guest,
      }),
    [audioSrc, guest, practiceOn, exerciseVideo],
  );
  const [request, setRequest] = useState<FeedbackWalkRequest | null>(null);
  const [end, setEnd] = useState(false);
  const [signUp, setSignUp] = useState(false);
  const [saved, setSaved] = useState<FeedbackWalkHelperWords[]>([]);
  const [decided, setDecided] = useState<string[]>([]);
  const [practised, setPractised] = useState<FeedbackWalkPractiseWords[]>([]);
  const [judged, setJudged] = useState<string[]>([]);
  const journal = useWalkJournalPost(true);
  const practise = useMemo(
    () =>
      walkPractiseIO<string>((item) => ({
        ...PRACTISE_SOURCE,
        feedbackId: item,
        exercise: item.startsWith("exercise-") ? EXERCISE_OFFER : null,
      })),
    [],
  );

  const review = useCallback(() => {
    const at = walkStart(model);
    if (at === null) return;
    setEnd(false);
    setRequest((r) => ({ seq: (r?.seq ?? 0) + 1, at }));
  }, [model]);
  // Opens by itself here only, so a picture needs no tap; the product opens
  // it on "Review feedback" alone (journey question 1).
  useEffect(() => {
    if (audioSrc) review();
  }, [audioSrc, review]);

  return (
    <div
      data-walk-harness="live"
      data-walk-saved={saved.map((s) => s.span.text).join("|")}
      data-walk-decided={decided.join("|")}
      data-walk-practised={practised.map((p) => p.phrase).join("|")}
      data-walk-judged={judged.join("|")}
    >
      <PageStandIn answers={{}} onReview={review} />
      <FeedbackWalk
        model={model}
        request={request}
        coachNote={{ text: COACH_NOTE, videoUrl: NO_VIDEO, takeIndex: TAKE_SHOWN }}
        firstTake={false}
        guest={guest}
        onGuest={() => setSignUp(true)}
        onSaveHelperWords={(save) => setSaved((list) => [...list, save])}
        onAcceptClearer={(item) => setDecided((list) => [...list, `accept:${item}`])}
        onKeepWords={(item) => setDecided((list) => [...list, `keep:${item}`])}
        practise={practise}
        onSavePractiseWords={(save) => setPractised((list) => [...list, save])}
        onJudge={(save) => setJudged((list) => [...list, `${save.item}:${save.answer}${save.earlier ? `<${save.earlier}` : ""}`])}
        onSkipJudging={(items) => setJudged((list) => [...list, ...items.map((item) => `${item}:skipped`)])}
        journal={journal}
        onEnd={() => setEnd(true)}
      />
      {end ? (
        <WalkEndSheet
          pill={{ label: PAGE_WORDS.recordTake(TAKE_SHOWN + 1), onClick: () => undefined, testId: "walk-end-record" }}
          link={{ label: COPY.endCardBack, onClick: () => setEnd(false), testId: "walk-end-back" }}
        />
      ) : null}
      <GuestSignUpDialog open={signUp} onSignUp={() => setSignUp(false)} onClose={() => setSignUp(false)} />
    </div>
  );
}
