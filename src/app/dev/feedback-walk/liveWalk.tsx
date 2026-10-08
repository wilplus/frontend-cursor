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
  buildFeedbackReplay,
  buildFeedbackWalk,
  walkStart,
  type FeedbackWalkItem,
} from "@/lib/willab/feedbackWalkModel";
import { quoteSpan } from "@/lib/willab/phraseTokens";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import PageStandIn from "./pageStandIn";
import type { ShareIO } from "@/lib/willab/walkShare";
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

/*  The finished walk played again (Q-IT643b A): once the walk has reached    */
/*  its end card, the page's bottom is the product's own (IdealTextActions)  */
/*  and its "Review feedback" link plays the walk again from what this        */
/*  harness noted: the helper words saved, the judgements given.             */
/*  &replay=1 starts with the walk already finished on SAMPLE answers.       */

/** No network, no file: the dark box with its play button. */
const NO_VIDEO = "data:video/mp4;base64,";

function openCardOf(m: Moment): FeedbackWalkItem["openCard"] {
  if (m.praise) return "praise";
  if (m.clearer) return "rewrite";
  if (m.exercise) return "exercise";
  return null;
}

const joined = (pieces: readonly Piece[]) => pieces.map((p) => p.text).join("");

/** A served rewrite as the walk receives it: the quote, the proposal and
 *  its signed move (the fixture's line above the words to say). */
function rewriteOf(m: Moment): FeedbackWalkItem<string>["rewrite"] {
  if (!m.clearer) return null;
  return {
    quote: joined(m.clearer.before),
    proposedText: joined(m.clearer.after),
    move: m.clearer.coachLine ?? null,
    item: `rewrite-${m.index}`,
  };
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

/** A stand-in server for the sharing screen (D-FW-20): the pass code
 *  "taken1" is taken, "nobody" joins nothing, a community named "terms"
 *  answers that the Terms must be accepted first; everything else shares. */
function standInShare(record: (line: string) => void): ShareIO {
  const fail = (status: number, code: string) => Promise.resolve({ ok: false as const, status, code });
  let terms = false;
  return {
    join: (code) => (code === "nobody" ? fail(404, "COMMUNITY_NOT_FOUND") : Promise.resolve({ ok: true, data: { id: `joined:${code}` } })),
    create: (name, code) => {
      terms = name === "terms";
      return code === "taken1" ? fail(409, "PASS_CODE_TAKEN") : Promise.resolve({ ok: true, data: { id: `own:${name}` } });
    },
    share: (choice) => {
      if (terms && !choice.none) return fail(409, "TERMS_REACCEPT_REQUIRED");
      record(choice.none ? "none" : [choice.general ? "general" : "", ...choice.communityIds, choice.shareWordsVersion].filter(Boolean).join(","));
      return Promise.resolve({ ok: true, data: {} });
    },
  };
}

/** SAMPLE answers for &replay=1: a walk already finished. */
const FINISHED_JUDGED = ["cv-0:yes", "cv-1:in_between", "cv-2:no", "cv-3:yes"];
function finishedSaved(): FeedbackWalkHelperWords[] {
  const span = quoteSpan(PARAGRAPHS[0], "our growth doubled,");
  return span ? [{ partId: "part-0", span, paragraphText: PARAGRAPHS[0] }] : [];
}

/** The latest answer the harness noted on an item ("cv-0:no<yes" is a
 *  change); a Skip is no answer. */
function latestAnswer(judged: readonly string[], item: string): ConfidenceRatingValue | null {
  for (let i = judged.length - 1; i >= 0; i -= 1) {
    const [who, rest] = judged[i].split(":");
    if (who !== item) continue;
    const answer = rest.split("<")[0];
    return answer === "skipped" ? null : (answer as ConfidenceRatingValue);
  }
  return null;
}

export default function LiveWalk({
  guest,
  practiceOn,
  exerciseVideo = true,
  finished: startFinished = false,
}: {
  guest: boolean;
  practiceOn: boolean;
  exerciseVideo?: boolean;
  /** Start with the walk already finished (&replay=1). */
  finished?: boolean;
}) {
  const audioSrc = useToneSrc();
  const model = useMemo(
    () =>
      buildFeedbackWalk({
        items: audioSrc ? liveItems(audioSrc, exerciseVideo) : [],
        coachNote: true,
        practiceOn,
        guest,
        sharing: true,
      }),
    [audioSrc, guest, practiceOn, exerciseVideo],
  );
  const [request, setRequest] = useState<FeedbackWalkRequest | null>(null);
  const [end, setEnd] = useState(false);
  const [signUp, setSignUp] = useState(false);
  const [saved, setSaved] = useState<FeedbackWalkHelperWords[]>(() => (startFinished ? finishedSaved() : []));
  const [decided, setDecided] = useState<string[]>([]);
  const [practised, setPractised] = useState<FeedbackWalkPractiseWords[]>([]);
  const [judged, setJudged] = useState<string[]>(() => (startFinished ? FINISHED_JUDGED : []));
  const [shared, setShared] = useState<string[]>([]);
  const share = useMemo(() => standInShare((line) => setShared((list) => [...list, line])), []);
  const [finished, setFinished] = useState(startFinished);
  const [replaying, setReplaying] = useState(false);
  const replayModel = useMemo(
    () =>
      buildFeedbackReplay({
        items: audioSrc && finished ? liveItems(audioSrc, exerciseVideo) : [],
        coachNote: true,
        practiceOn,
        answerOf: (item) => latestAnswer(judged, item),
        helperWordsOf: (partId) => [...saved].reverse().find((s) => s.partId === partId)?.span.text ?? null,
      }),
    [audioSrc, finished, exerciseVideo, practiceOn, judged, saved],
  );
  const reviewAgain = useCallback(() => {
    const at = walkStart(replayModel);
    if (at === null) return;
    setReplaying(true);
    setEnd(false);
    setRequest((r) => ({ seq: (r?.seq ?? 0) + 1, at }));
  }, [replayModel]);
  const pageAnswers = useMemo(() => {
    const out: Record<number, ConfidenceRatingValue> = {};
    MOMENTS.forEach((m) => {
      const answer = latestAnswer(judged, `cv-${m.index}`);
      if (answer) out[m.index] = answer;
    });
    return out;
  }, [judged]);
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
    setReplaying(false);
    setEnd(false);
    setRequest((r) => ({ seq: (r?.seq ?? 0) + 1, at }));
  }, [model]);
  // Opens by itself here only, so a picture needs no tap; the product opens
  // it on "Review feedback" alone (journey question 1).
  useEffect(() => {
    if (audioSrc && !startFinished) review();
  }, [audioSrc, review, startFinished]);

  return (
    <div
      data-walk-harness="live"
      data-walk-saved={saved.map((s) => s.span.text).join("|")}
      data-walk-decided={decided.join("|")}
      data-walk-practised={practised.map((p) => p.phrase).join("|")}
      data-walk-judged={judged.join("|")}
      data-walk-shared={shared.join("|")}
    >
      <PageStandIn
        answers={finished ? pageAnswers : {}}
        onReview={review}
        onReviewAgain={finished && walkStart(replayModel) !== null ? reviewAgain : null}
      />
      <FeedbackWalk
        model={replaying ? replayModel : model}
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
        share={share}
        onEnd={() => {
          setEnd(true);
          setFinished(true);
        }}
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
