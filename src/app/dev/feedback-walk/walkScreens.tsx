"use client";

import type { ReactNode } from "react";
import CoachVideo from "@/components/willab/CoachVideo";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "@/components/willab/idealEditCopy";
import WalkOverlay, { type WalkNav } from "@/components/willab/walk/WalkOverlay";
import WalkMessage, { WalkNewWords } from "@/components/willab/walk/WalkMessage";
import WalkPlayer from "@/components/willab/walk/WalkPlayer";
import WalkJudgement from "@/components/willab/walk/WalkJudgement";
import WalkFooter from "@/components/willab/walk/WalkFooter";
import WalkOptions, { WalkField, type WalkOption } from "@/components/willab/walk/WalkOptions";
import WalkLoading from "@/components/willab/walk/WalkLoading";
import WalkWordPicker from "@/components/willab/walk/WalkWordPicker";
import RecordingStrip from "@/components/willab/walk/RecordingStrip";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import {
  COACH_NOTE,
  MOMENTS,
  PARAGRAPHS,
  SLIDE_LABEL,
  TAKE_SHOWN,
  BANK_PICKS,
  type Piece,
  type Step,
} from "./walkFixtures";

/* -------------------------------------------------------------------------- */
/*  The prototype's screens, composed from the walk's primitives. DEV ONLY.    */
/*  One function per screen; the host (page.tsx) owns the state and the       */
/*  order. Nothing here is mounted by the product (build plan P1).            */
/* -------------------------------------------------------------------------- */

export type WalkCtx = {
  step: Step;
  first: boolean;
  audioSrc: string | null;
  forward: () => void;
  back: () => void;
  close: () => void;
  answers: Record<number, ConfidenceRatingValue>;
  answer: (moment: number, value: ConfidenceRatingValue) => void;
  helpers: Record<number, number[]>;
  pickHelpers: (moment: number, picked: number[]) => void;
  community: string[];
  setCommunity: (next: string[]) => void;
  elapsed: number;
};

/** No network, no file: the dark box with its play button. */
const NO_VIDEO = "data:video/mp4;base64,";

const mom = (ctx: WalkCtx) => MOMENTS[ctx.step.moment ?? 0];
const testId = (ctx: WalkCtx) => `walk-screen-${ctx.step.key}`;

function momentNav(ctx: WalkCtx): WalkNav {
  return {
    label: SLIDE_LABEL,
    index: ctx.step.moment ?? 0,
    total: MOMENTS.length,
    onBack: ctx.back,
    onNext: ctx.forward,
    backDisabled: ctx.first,
  };
}

function player(ctx: WalkCtx, words?: ReactNode) {
  const m = mom(ctx);
  return (
    <WalkPlayer
      seed={`moment-${m.index}`}
      src={ctx.audioSrc}
      durationMs={m.durationMs}
      label={`${COPY.pagerMoment} ${m.index + 1} ${COPY.pagerOf} ${MOMENTS.length}`}
      words={words}
    />
  );
}

function pieces(list: readonly Piece[]) {
  return list.map((p, i) => {
    if (p.cut) return <s key={i}>{p.text}</s>;
    if (p.fresh) return <em key={i}>{p.text}</em>;
    return <span key={i}>{p.text}</span>;
  });
}

function CoachNote(ctx: WalkCtx) {
  const nav: WalkNav = {
    position: `${COPY.historyTake} ${TAKE_SHOWN}`,
    index: 0,
    total: 1,
    onBack: ctx.back,
    onNext: ctx.forward,
    backDisabled: true,
  };
  return (
    <WalkOverlay
      testId={testId(ctx)}
      nav={nav}
      onClose={ctx.close}
      footer={<WalkFooter pill={{ label: COPY.pillContinue, onClick: ctx.forward, testId: "walk-forward" }} />}
    >
      <CoachVideo src={NO_VIDEO} className="w-full flex-none" />
      <WalkMessage>{COACH_NOTE}</WalkMessage>
    </WalkOverlay>
  );
}

function Praise(ctx: WalkCtx) {
  const m = mom(ctx);
  return (
    <WalkOverlay
      testId={testId(ctx)}
      nav={momentNav(ctx)}
      onClose={ctx.close}
      title={COPY.titlePraise}
      footer={<WalkFooter pill={{ label: COPY.pagerNext, onClick: ctx.forward, testId: "walk-forward" }} />}
    >
      {player(ctx)}
      <WalkMessage>{m.praise?.text}</WalkMessage>
    </WalkOverlay>
  );
}

function Clearer(ctx: WalkCtx) {
  const c = mom(ctx).clearer;
  return (
    <WalkOverlay
      testId={testId(ctx)}
      nav={momentNav(ctx)}
      onClose={ctx.close}
      title={COPY.cardClearerVersion}
      footer={
        <WalkFooter
          pill={{ label: COPY.pillAcceptPractise, onClick: ctx.forward, testId: "walk-forward" }}
          links={[{ label: COPY.linkKeepMyWords, onClick: ctx.forward }]}
        />
      }
    >
      {player(ctx, pieces(c?.before ?? []))}
      <WalkMessage>
        <span>{WALK_COPY.clearerOffer}</span>
        <WalkNewWords>{pieces(c?.after ?? [])}</WalkNewWords>
        <span>{WALK_COPY.clearerAsk}</span>
      </WalkMessage>
    </WalkOverlay>
  );
}

function ExVideo(ctx: WalkCtx) {
  return (
    <WalkOverlay
      testId={testId(ctx)}
      nav={momentNav(ctx)}
      onClose={ctx.close}
      title={COPY.titleExercise}
      footer={
        <WalkFooter
          pill={{ label: WALK_COPY.exercisePractise, onClick: ctx.forward, testId: "walk-forward" }}
          links={[{ label: WALK_COPY.skip, onClick: ctx.forward }]}
        />
      }
    >
      <CoachVideo src={NO_VIDEO} className="w-full flex-none [&>video]:aspect-[4/5] [&>video]:object-cover" />
    </WalkOverlay>
  );
}

/** Practising: recording from the start; no title, no slide bar. */
function Practise(ctx: WalkCtx) {
  const m = mom(ctx);
  const words = ctx.step.kind === "words";
  return (
    <WalkOverlay
      testId={testId(ctx)}
      onClose={ctx.close}
      footer={
        <WalkFooter links={[{ label: WALK_COPY.skip, onClick: ctx.forward }]}>
          <RecordingStrip elapsed={ctx.elapsed} stopLabel={COPY.pillStop} onStop={ctx.forward} />
        </WalkFooter>
      }
    >
      <WalkMessage>{words ? m.clearer?.coachLine : m.exercise?.instruction}</WalkMessage>
      <p className="m-0 text-[25px] font-semibold leading-[1.35]">{words ? m.clearer?.say : PARAGRAPHS[m.index]}</p>
    </WalkOverlay>
  );
}

function Processing(ctx: WalkCtx) {
  return (
    <WalkOverlay testId={testId(ctx)} onClose={ctx.close} bare>
      <WalkLoading />
    </WalkOverlay>
  );
}

function Improved(ctx: WalkCtx) {
  return (
    <WalkOverlay
      testId={testId(ctx)}
      nav={momentNav(ctx)}
      onClose={ctx.close}
      title={COPY.titlePraise}
      footer={<WalkFooter pill={{ label: COPY.pagerNext, onClick: ctx.forward, testId: "walk-forward" }} />}
    >
      {player(ctx)}
      <WalkMessage>{BANK_PICKS.improved}</WalkMessage>
    </WalkOverlay>
  );
}

function Encourage(ctx: WalkCtx) {
  return (
    <WalkOverlay
      testId={testId(ctx)}
      nav={momentNav(ctx)}
      onClose={ctx.close}
      title={COPY.titlePractise}
      footer={
        <WalkFooter
          pill={{ label: COPY.pillContinue, onClick: ctx.forward, testId: "walk-forward" }}
          links={[{ label: WALK_COPY.skip, onClick: ctx.forward }]}
        />
      }
    >
      {player(ctx)}
      <WalkMessage>{WALK_COPY.encourage}</WalkMessage>
    </WalkOverlay>
  );
}

function Helpers(ctx: WalkCtx) {
  const m = mom(ctx);
  const picked = ctx.helpers[m.index] ?? [];
  return (
    <WalkOverlay
      testId={testId(ctx)}
      onClose={ctx.close}
      title={COPY.titleEmphasis}
      footer={
        <WalkFooter
          pill={{ label: COPY.pillEmphasise, onClick: ctx.forward, disabled: picked.length === 0, testId: "walk-forward" }}
          links={[{ label: WALK_COPY.skip, onClick: ctx.forward, testId: "walk-skip" }]}
        />
      }
    >
      <p className="m-0 text-[14.5px] text-muted-foreground">{COPY.emphasisFirstTakeNote}</p>
      <WalkWordPicker
        words={PARAGRAPHS[m.index].split(" ")}
        picked={picked}
        onChange={(next) => ctx.pickHelpers(m.index, next)}
      />
    </WalkOverlay>
  );
}

/** "Judgement time!": a screen that stands apart. */
function Intro(ctx: WalkCtx) {
  return (
    <WalkOverlay
      testId={testId(ctx)}
      onClose={ctx.close}
      bare
      footer={
        <WalkFooter
          pill={{ label: WALK_COPY.judgementPromise, onClick: ctx.forward, testId: "walk-forward" }}
          links={[{ label: WALK_COPY.skip, onClick: ctx.forward }]}
        />
      }
    >
      <div className="flex flex-1 flex-col justify-center gap-3.5 px-7 text-center">
        <h2 className="m-0 text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em]">{WALK_COPY.judgementTitle}</h2>
        <p className="m-0 text-[16px] leading-[1.5]">{WALK_COPY.judgementHonesty}</p>
        {/* Opens the Journal post inside the flow (P4); inert until then. */}
        <button
          type="button"
          className="mx-auto text-[14px] text-muted-foreground underline underline-offset-[3px]"
        >
          {WALK_COPY.judgementJournalLink}
        </button>
      </div>
    </WalkOverlay>
  );
}

function Judge(ctx: WalkCtx) {
  const m = mom(ctx);
  return (
    <WalkOverlay testId={testId(ctx)} nav={momentNav(ctx)} onClose={ctx.close} title={COPY.titleFeedback}>
      {player(ctx)}
      <WalkJudgement value={ctx.answers[m.index] ?? null} onAnswer={(v) => ctx.answer(m.index, v)} />
    </WalkOverlay>
  );
}

const COMMUNITY: readonly WalkOption[] = [
  { value: "general", label: WALK_COPY.shareGeneral, hint: WALK_COPY.shareGeneralHint },
  {
    value: "mine",
    label: WALK_COPY.shareMine,
    hint: WALK_COPY.shareMineHint,
    fields: <WalkField placeholder={WALK_COPY.fieldPassCode} />,
  },
  {
    value: "own",
    label: WALK_COPY.shareOwn,
    fields: (
      <>
        <WalkField placeholder={WALK_COPY.fieldCommunityName} />
        <WalkField placeholder={WALK_COPY.fieldPassCode} />
      </>
    ),
  },
  { value: "none", label: WALK_COPY.shareNone, hint: WALK_COPY.shareNoneHint, exclusive: true },
];

/** Sharing: a screen that stands apart; several ticks, the last alone. */
function Community(ctx: WalkCtx) {
  return (
    <WalkOverlay
      testId={testId(ctx)}
      onClose={ctx.forward}
      bare
      footer={
        <WalkFooter
          pill={{
            label: COPY.pillContinue,
            onClick: ctx.forward,
            disabled: ctx.community.length === 0,
            testId: "walk-forward",
          }}
        />
      }
    >
      <div className="flex flex-col gap-2.5 px-6 pb-1.5 pt-7">
        <h2 className="m-0 text-balance text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em]">
          {WALK_COPY.shareTitle}
        </h2>
        <p className="m-0 text-[16px] leading-[1.5]">{WALK_COPY.shareAsk}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3.5">
        <WalkOptions options={COMMUNITY} selected={ctx.community} onChange={ctx.setCommunity} />
      </div>
    </WalkOverlay>
  );
}

const SCREENS: Record<Exclude<Step["key"], "page" | "end">, (ctx: WalkCtx) => ReactNode> = {
  coachnote: CoachNote,
  praise: Praise,
  clearer: Clearer,
  exVideo: ExVideo,
  practise: Practise,
  processing: Processing,
  improved: Improved,
  encourage: Encourage,
  helpers: Helpers,
  intro: Intro,
  judge: Judge,
  community: Community,
};

export function renderWalkScreen(ctx: WalkCtx): ReactNode {
  const key = ctx.step.key;
  if (key === "page" || key === "end") return null;
  return SCREENS[key](ctx);
}
