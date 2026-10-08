"use client";

import type { ReactNode } from "react";
import BodyBlocks from "@/components/journal/BodyBlocks";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import WalkOverlay, { type WalkNav } from "./WalkOverlay";
import WalkFooter from "./WalkFooter";
import WalkJudgement from "./WalkJudgement";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";

/* -------------------------------------------------------------------------- */
/*  "Judgement time!", the Journal post and the judgement (build plan          */
/*  D-FW-18; founder lock 2026-10-06, flow 9-10; JP1 A, Q-B4 A, WQ4 A).        */
/*                                                                            */
/*    intro    a screen that stands apart (it cross-fades in): the title, the */
/*             honesty line, the grey link to the Journal post, the black     */
/*             "I am going to judge them honestly" and a grey "Skip". With no */
/*             post to open, there is no link.                                */
/*    journal  the published self-modeling post inside the overlay: ‹ and     */
/*             "Back" return to the intro; "Journal" above the post's title   */
/*             (Q-B4 A). The title and the words are the post's own.          */
/*    judge    "Feedback", the moment bar, the speaker's voice only and the   */
/*             one judgement screen (WalkJudgement): an answer fills black,   */
/*             holds 0.28 s and moves on with the toast (WQ4 A).              */
/*                                                                            */
/*  Drawn as the dev harness's stills draw them (src/app/dev/feedback-walk/   */
/*  walkScreens), which use these very components. Every word is signed      */
/*  (WALK_COPY, CHUNK_SHEET_COPY) or the post's own; no number (AC-9).        */
/* -------------------------------------------------------------------------- */

/** The Journal post as the walk draws it: its title and its plain-text body
 *  (the Journal's body format, drawn by the Journal's one renderer). */
export type WalkJournalPost = { title: string; body: string };

export function JudgementIntro({
  testId,
  onClose,
  onPromise,
  onSkip,
  onJournal,
}: {
  testId?: string;
  onClose?: () => void;
  onPromise: () => void;
  onSkip: () => void;
  /** Opens the Journal post; none: the post could not be read, no link. */
  onJournal?: (() => void) | null;
}) {
  return (
    <WalkOverlay
      testId={testId}
      onClose={onClose}
      bare
      footer={
        <WalkFooter
          pill={{ label: WALK_COPY.judgementPromise, onClick: onPromise, testId: "walk-forward" }}
          links={[{ label: WALK_COPY.skip, onClick: onSkip, testId: "walk-skip" }]}
        />
      }
    >
      <div className="flex flex-1 flex-col justify-center gap-3.5 px-7 text-center">
        <h2 className="m-0 text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em]">{WALK_COPY.judgementTitle}</h2>
        <p className="m-0 text-[16px] leading-[1.5]">{WALK_COPY.judgementHonesty}</p>
        {onJournal ? (
          <button
            type="button"
            data-testid="walk-journal"
            onClick={onJournal}
            className="mx-auto text-[14px] text-muted-foreground underline underline-offset-[3px]"
          >
            {WALK_COPY.judgementJournalLink}
          </button>
        ) : null}
      </div>
    </WalkOverlay>
  );
}

export function JournalPostScreen({
  testId,
  post,
  onBack,
}: {
  testId?: string;
  post: WalkJournalPost;
  onBack: () => void;
}) {
  return (
    <WalkOverlay
      testId={testId}
      onBack={onBack}
      footer={<WalkFooter links={[{ label: COPY.linkBack, onClick: onBack, testId: "walk-journal-back" }]} />}
    >
      <span data-walk-eyebrow className="text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
        {WALK_COPY.journalEyebrow}
      </span>
      <h2 data-walk-journal-title className="m-0 text-[22px] font-bold leading-[1.2] tracking-[-0.01em]">
        {post.title}
      </h2>
      <BodyBlocks body={post.body} />
    </WalkOverlay>
  );
}

export function JudgeScreen({
  testId,
  nav,
  onClose,
  player,
  value,
  onAnswer,
}: {
  testId?: string;
  nav: WalkNav;
  onClose?: () => void;
  /** The speaker's voice for the moment (WalkPlayer), no words. */
  player: ReactNode;
  /** The answer given earlier in this walk, drawn pressed (‹ reopened it). */
  value: ConfidenceRatingValue | null;
  onAnswer: (value: ConfidenceRatingValue) => void;
}) {
  return (
    <WalkOverlay testId={testId} nav={nav} onClose={onClose} title={COPY.titleFeedback}>
      {player}
      <WalkJudgement value={value} onAnswer={onAnswer} />
    </WalkOverlay>
  );
}
