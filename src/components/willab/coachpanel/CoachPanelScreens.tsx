"use client";

/* -------------------------------------------------------------------------- */
/*  The coach panel's P1 screens (founder lock 2026-10-06, the coach panel     */
/*  redrawn, flow steps 2 to 5), drawn from the Feedback walk's primitives:    */
/*                                                                            */
/*    QueueScreen    Your queue: your speakers, each with how many moments    */
/*                   wait; "Also waiting · blind" only when the backend       */
/*                   serves those lines (both switched off today)             */
/*    SpeakerScreen  one speaker's Takes                                      */
/*    JudgeScreen    the player, the question, the five answers. NOTHING     */
/*                   ELSE (BLIND COACH): no passage, no kind, no machine      */
/*                   read, no slide                                           */
/*    RevealScreen   What happened: the passage with its player; You, the     */
/*                   speaker, The machine heard                               */
/*                                                                            */
/*  Presentational: the host (CoachPanel) owns the state, the fetches and the */
/*  saves. Every word comes from COACH_PANEL_COPY or from the data; nothing   */
/*  here is a score (AC-9): the only numbers are counts of moments waiting    */
/*  and a moment's position.                                                  */
/* -------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import WalkOverlay, { walkNavText, type WalkNav } from "../walk/WalkOverlay";
import WalkPlayer from "../walk/WalkPlayer";
import WalkJudgement from "../walk/WalkJudgement";
import WalkFooter from "../walk/WalkFooter";
import WalkLoading from "../walk/WalkLoading";
import WalkChoices, { type WalkChoice } from "../walk/WalkChoices";
import DeckSlidePreview from "../DeckSlidePreview";
import { OWNER_PRIMARY_RATING_OPTIONS } from "../ConfidenceLabelChips";
import { answerWord, type AnswerValue, type QueueSpeaker, type QueueTake, type ReadSlide } from "@/lib/willab/coachWalk";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";
import type { MomentRead } from "@/services/api/coachWalk";
import type { BlockPickQueue, ErrorAuditQueue } from "@/services/api/coachPanel";

/** A moment's clip, from the coach's review session. */
export type PanelClip = { src: string | null; startOffsetMs: number; durationMs: number };

/* ── shared bits ─────────────────────────────────────────────────────── */

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</span>
  );
}

function Group({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <section data-testid={testId} className="flex flex-col gap-2">
      <GroupLabel>{label}</GroupLabel>
      {children}
    </section>
  );
}

function Player({ nav, momentId, clip, words }: {
  nav: WalkNav; momentId: string; clip: PanelClip | null; words?: ReactNode;
}) {
  return (
    <WalkPlayer
      seed={momentId}
      src={clip?.src ?? null}
      startOffsetMs={clip?.startOffsetMs ?? null}
      durationMs={clip?.durationMs ?? null}
      label={walkNavText(nav)}
      words={words}
    />
  );
}

/* ── Your queue ──────────────────────────────────────────────────────── */

/** One speaker as a choice: moments waiting, a Take still waiting for its
 *  text, or all answered. Pure. */
export function speakerChoice(speaker: QueueSpeaker, index: number): WalkChoice {
  const value = `${index}`;
  if (speaker.waiting > 0) {
    return { value, label: speaker.pseudonym, subtitle: COPY.momentsWaiting(speaker.waiting) };
  }
  if (speaker.takes.some((t) => t.waitingForText)) {
    return { value, label: speaker.pseudonym, subtitle: COPY.waitingForText, done: true, dim: true };
  }
  return { value, label: speaker.pseudonym, subtitle: COPY.answered, mark: "check" };
}

export type BlindRows = {
  audit: ErrorAuditQueue | null;
  picks: BlockPickQueue | null;
  onOpenAudit: () => void;
  onOpenPicks: () => void;
};

/** "Also waiting · blind": drawn only when the backend serves a line with
 *  something in it. Its words are the backend's own, as in today's queue. */
function BlindGroup({ blind }: { blind: BlindRows }) {
  const audit = blind.audit && blind.audit.items.length > 0 ? blind.audit : null;
  const picks = blind.picks && blind.picks.items.length > 0 ? blind.picks : null;
  if (!audit && !picks) return null;
  const choices: WalkChoice[] = [];
  if (audit) choices.push({ value: "audit", label: audit.wording.title ?? "", subtitle: COPY.blindWaiting(audit.items.length) });
  if (picks) {
    choices.push({
      value: "picks",
      label: picks.wording.short_title ?? picks.wording.title ?? "",
      subtitle: COPY.blindWaiting(picks.items.length),
    });
  }
  const line = audit?.wording.queue_line ?? picks?.wording.queue_line ?? "";
  return (
    <Group label={line} testId="coach-panel-blind">
      <WalkChoices
        label={line}
        choices={choices}
        onPick={(v) => (v === "audit" ? blind.onOpenAudit() : blind.onOpenPicks())}
      />
    </Group>
  );
}

export function QueueScreen({ speakers, loading, blind, onSpeaker, onClose }: {
  speakers: readonly QueueSpeaker[];
  loading: boolean;
  blind: BlindRows | null;
  onSpeaker: (speaker: QueueSpeaker) => void;
  onClose: () => void;
}) {
  return (
    <WalkOverlay title={COPY.queueTitle} onClose={onClose} testId="coach-panel-queue">
      {speakers.length > 0 ? (
        <Group label={COPY.yourSpeakers} testId="coach-panel-speakers">
          <WalkChoices
            label={COPY.yourSpeakers}
            choices={speakers.map(speakerChoice)}
            onPick={(v) => {
              const speaker = speakers[Number(v)];
              if (speaker) onSpeaker(speaker);
            }}
          />
        </Group>
      ) : loading ? (
        <WalkLoading />
      ) : (
        <p className="m-0 text-[16px]">{COPY.queueEmpty}</p>
      )}
      {blind ? <BlindGroup blind={blind} /> : null}
    </WalkOverlay>
  );
}

/* ── A speaker ───────────────────────────────────────────────────────── */

/** The speaker's Takes, the newest first (as the prototype lists them). */
export function takesNewestFirst(takes: readonly QueueTake[]): QueueTake[] {
  return [...takes].sort((a, b) => (b.takeIndex ?? 0) - (a.takeIndex ?? 0));
}

/** One Take as a choice. Pure. */
export function takeChoice(take: QueueTake, index: number): WalkChoice {
  const label = COPY.take(take.takeIndex);
  const value = take.sessionId;
  if (take.waitingForText) return { value, label, subtitle: COPY.waitingForText, done: true, dim: true };
  if (take.waiting > 0) return { value, label, subtitle: COPY.takeWaiting(take.waiting, take.moments.length) };
  const subtitle = index === 0 ? COPY.allMomentsAnswered : COPY.answeredMoments(take.moments.length);
  return { value, label, subtitle, done: true, mark: "check" };
}

export function SpeakerScreen({ speaker, onTake, onBack, onClose }: {
  speaker: QueueSpeaker;
  onTake: (take: QueueTake) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const takes = takesNewestFirst(speaker.takes);
  return (
    <WalkOverlay title={speaker.pseudonym} onBack={onBack} onClose={onClose} testId="coach-panel-speaker">
      {/* The goal sits here once the queue carries it before rating
          (backend gap: GET /v2/coach/students?with=waiting,goal). */}
      <WalkChoices
        label={speaker.pseudonym}
        choices={takes.map(takeChoice)}
        onPick={(v) => {
          const take = takes.find((t) => t.sessionId === v);
          if (take) onTake(take);
        }}
      />
    </WalkOverlay>
  );
}

/* ── Judge this moment (blind) ───────────────────────────────────────── */

export function JudgeScreen({ nav, momentId, clip, error, attempt, onAnswer, onClose }: {
  nav: WalkNav;
  momentId: string;
  clip: PanelClip | null;
  error: string | null;
  /** A new try after a failed save draws the answers unfilled again. */
  attempt: number;
  onAnswer: (value: AnswerValue) => void;
  onClose: () => void;
}) {
  return (
    <WalkOverlay nav={nav} title={COPY.judgeTitle} onClose={onClose} testId="coach-panel-judge">
      <Player nav={nav} momentId={momentId} clip={clip} />
      <WalkJudgement key={attempt} question={COPY.judgeQuestion} primary={OWNER_PRIMARY_RATING_OPTIONS} onAnswer={onAnswer} />
      {error ? <p role="alert" className="m-0 text-center text-[14px] text-destructive">{error}</p> : null}
    </WalkOverlay>
  );
}

/* ── What happened ───────────────────────────────────────────────────── */

export type RevealLine = { label: string; value: string };

/** The three lines, each only when the data has it: You, the speaker, The
 *  machine heard (what fired, by its name; absent for praise and rewrite
 *  moments, where the read carries nothing). Pure. */
export function revealLines(
  read: MomentRead,
  pseudonym: string,
  justRated: AnswerValue | null,
): RevealLine[] {
  const lines: RevealLine[] = [];
  const you = answerWord(justRated ?? read.coachAnswer);
  if (you) lines.push({ label: COPY.you, value: you });
  const speaker = answerWord(read.speakerAnswer);
  if (speaker) lines.push({ label: pseudonym, value: speaker });
  const heard = (read.request?.spotted ?? []).map((s) => s.label).filter(Boolean);
  if (heard.length > 0) lines.push({ label: COPY.machineHeard, value: heard.join(" · ") });
  return lines;
}

function Facts({ lines }: { lines: RevealLine[] }) {
  return (
    <dl data-testid="coach-panel-facts" className="m-0 flex flex-col gap-2 text-[15.5px]">
      {lines.map((line) => (
        <div key={line.label} className="flex justify-between gap-3 border-b border-border pb-2">
          <dt className="text-muted-foreground">{line.label}</dt>
          <dd className="m-0 text-right font-semibold">{line.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RevealScreen({ nav, momentId, clip, slide, read, pseudonym, justRated, onNext, onClose }: {
  nav: WalkNav;
  momentId: string;
  clip: PanelClip | null;
  slide: ReadSlide | null;
  /** undefined while it loads, null when it could not be read. */
  read: MomentRead | null | undefined;
  pseudonym: string;
  justRated: AnswerValue | null;
  onNext: () => void;
  onClose: () => void;
}) {
  const footer = read ? <WalkFooter pill={{ label: COPY.next, onClick: onNext, testId: "coach-panel-reveal-next" }} /> : null;
  return (
    <WalkOverlay nav={nav} title={COPY.whatHappened} onClose={onClose} footer={footer} testId="coach-panel-reveal">
      {read === undefined ? <WalkLoading /> : null}
      {read === null ? <p role="alert" className="m-0 text-[15px]">{COPY.readFail}</p> : null}
      {read ? (
        <>
          {slide ? (
            <div data-testid="coach-panel-slide" className="w-[48%] shrink-0">
              <DeckSlidePreview presentationRef={slide.presentationRef} pageIndex={slide.pageIndex} size="header" className="" />
            </div>
          ) : null}
          <Player
            nav={nav}
            momentId={momentId}
            clip={clip}
            words={read.passage ? <span data-testid="coach-panel-passage">{read.passage}</span> : null}
          />
          <Facts lines={revealLines(read, pseudonym, justRated)} />
        </>
      ) : null}
    </WalkOverlay>
  );
}
