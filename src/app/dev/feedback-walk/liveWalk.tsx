"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FeedbackWalk, {
  type FeedbackWalkHelperWords,
  type FeedbackWalkRequest,
} from "@/components/willab/walk/FeedbackWalk";
import WalkEndSheet from "@/components/willab/walk/WalkEndSheet";
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
} from "./walkFixtures";

/* -------------------------------------------------------------------------- */
/*  /dev/feedback-walk?live=1 — the PRODUCTION walk (FeedbackWalk, build plan  */
/*  D-FW-14) on the harness's fixtures, so the screenshot harness (X7) draws  */
/*  the coach's note, the praise and the helper words from the component the  */
/*  page mounts, not from the harness's own copy of them. DEV ONLY: page.tsx  */
/*  renders nothing in production.                                            */
/*                                                                            */
/*  It opens on the walk's first screen, as "Review feedback" does; the page  */
/*  stand-in's own button opens it again. &guest=1 draws it for a guest: a    */
/*  pick opens the sign-up dialog and nothing is saved.                       */
/* -------------------------------------------------------------------------- */

/** No network, no file: the dark box with its play button. */
const NO_VIDEO = "data:video/mp4;base64,";

function openCardOf(m: Moment): FeedbackWalkItem["openCard"] {
  if (m.praise) return "praise";
  if (m.clearer) return "rewrite";
  if (m.exercise) return "exercise";
  return null;
}

/** The fixtures as the page hands them to the walk: one item per moment. */
function liveItems(audioSrc: string): FeedbackWalkItem[] {
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

export default function LiveWalk({ guest }: { guest: boolean }) {
  const audioSrc = useToneSrc();
  const model = useMemo(
    () =>
      buildFeedbackWalk({
        items: audioSrc ? liveItems(audioSrc) : [],
        coachNote: true,
        practiceOn: true,
        guest,
      }),
    [audioSrc, guest],
  );
  const [request, setRequest] = useState<FeedbackWalkRequest | null>(null);
  const [end, setEnd] = useState(false);
  const [signUp, setSignUp] = useState(false);
  const [saved, setSaved] = useState<FeedbackWalkHelperWords[]>([]);

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
    <div data-walk-harness="live" data-walk-saved={saved.map((s) => s.span.text).join("|")}>
      <PageStandIn answers={{}} onReview={review} />
      <FeedbackWalk
        model={model}
        request={request}
        coachNote={{ text: COACH_NOTE, videoUrl: NO_VIDEO, takeIndex: TAKE_SHOWN }}
        firstTake={false}
        guest={guest}
        onGuest={() => setSignUp(true)}
        onSaveHelperWords={(save) => setSaved((list) => [...list, save])}
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
