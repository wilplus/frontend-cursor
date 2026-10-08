"use client";

/* -------------------------------------------------------------------------- */
/*  The coach panel's P1 screens (founder lock 2026-10-06, the coach panel     */
/*  redrawn, flow steps 2 to 5), drawn from the Feedback walk's primitives:    */
/*                                                                            */
/*    QueueScreen    Your queue: your speakers, each with how many moments    */
/*                   wait; "Also waiting · blind" only when the backend       */
/*                   serves those lines (both switched off today)             */
/*    SpeakersScreen Your speakers: every speaker this coach may hear, an     */
/*                   orange dot on those waiting (flow step 1; D-CP-12)      */
/*    SpeakerScreen  one speaker: their goal and their Takes                 */
/*    JudgeScreen    the player, the question, the five answers. NOTHING     */
/*                   ELSE (BLIND COACH): no passage, no kind, no machine      */
/*                   read, no slide                                           */
/*    RevealScreen   What happened: the passage with its player; You, the     */
/*                   speaker, The machine heard (in signed words only,        */
/*                   D-CP-13; left out on a clearer version, Q-CP13a A)       */
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
import type { BlockPickQueue, ErrorAuditQueue, V4MomentPickQueue, V4SurerQueue } from "@/services/api/coachPanel";
import type { PanelSpeaker } from "@/services/api/coachSpeakers";

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
  /** V4's two blind sheets (S-B8 A), under the same line; dark until on. */
  v4Picks?: V4MomentPickQueue | null;
  v4Surer?: V4SurerQueue | null;
  onOpenV4Picks?: () => void;
  onOpenV4Surer?: () => void;
};

/** "Also waiting · blind": drawn only when the backend serves a line with
 *  something in it. Its words are the backend's own, as in today's queue. */
type BlindQueue = { items: readonly unknown[]; wording: Record<string, string> };

/** The blind rows that have something waiting, in the panel's order, each
 *  with its row label (the backend's signed words). */
function waitingRows(blind: BlindRows): { value: string; queue: BlindQueue; label: string; open?: () => void }[] {
  const rows = [
    { value: "audit", queue: blind.audit, label: (w: Record<string, string>) => w.title, open: blind.onOpenAudit },
    { value: "picks", queue: blind.picks, label: (w: Record<string, string>) => w.short_title ?? w.title, open: blind.onOpenPicks },
    { value: "v4picks", queue: blind.v4Picks, label: (w: Record<string, string>) => w.row, open: blind.onOpenV4Picks },
    { value: "v4surer", queue: blind.v4Surer, label: (w: Record<string, string>) => w.row, open: blind.onOpenV4Surer },
  ];
  return rows.flatMap((r) => (r.queue && r.queue.items.length > 0
    ? [{ value: r.value, queue: r.queue, label: r.label(r.queue.wording) ?? "", open: r.open }]
    : []));
}

function BlindGroup({ blind }: { blind: BlindRows }) {
  const rows = waitingRows(blind);
  if (rows.length === 0) return null;
  const choices: WalkChoice[] = rows.map((r) => ({
    value: r.value, label: r.label, subtitle: COPY.blindWaiting(r.queue.items.length),
  }));
  const line = rows.map((r) => r.queue.wording.queue_line).find((l) => l !== undefined) ?? "";
  return (
    <Group label={line} testId="coach-panel-blind">
      <WalkChoices
        label={line}
        choices={choices}
        onPick={(v) => rows.find((r) => r.value === v)?.open?.()}
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

/* ── Your speakers ───────────────────────────────────────────────────── */

/** One speaker in the list of every speaker: moments waiting with the orange
 *  dot, a Take still waiting for its text, or all answered with how many
 *  Takes. Pure. */
export function allSpeakersChoice(speaker: PanelSpeaker, index: number): WalkChoice {
  const value = `${index}`;
  if (speaker.waiting > 0) {
    return { value, label: speaker.pseudonym, subtitle: COPY.momentsWaiting(speaker.waiting), dot: true };
  }
  // Faded, and not pressable, only while the speaker has nothing but a Take
  // waiting for its text (the prototype's Calm Otter); a speaker with answered
  // Takes beside it stays a row that opens.
  const answeredTakes = Math.max(0, speaker.takeCount - speaker.waitingForText);
  if (speaker.waitingForText > 0 && answeredTakes === 0) {
    return { value, label: speaker.pseudonym, subtitle: COPY.waitingForText, done: true, dim: true };
  }
  return { value, label: speaker.pseudonym, subtitle: COPY.allAnsweredTakes(answeredTakes) };
}

export function SpeakersScreen({ speakers, loading, onSpeaker, onClose }: {
  /** null while it loads or when it could not be read. */
  speakers: readonly PanelSpeaker[] | null;
  loading: boolean;
  onSpeaker: (speaker: PanelSpeaker) => void;
  onClose: () => void;
}) {
  return (
    <WalkOverlay title={COPY.yourSpeakers} onClose={onClose} testId="coach-panel-all-speakers">
      {speakers && speakers.length > 0 ? (
        <WalkChoices
          label={COPY.yourSpeakers}
          choices={speakers.map(allSpeakersChoice)}
          onPick={(v) => {
            const speaker = speakers[Number(v)];
            if (speaker) onSpeaker(speaker);
          }}
        />
      ) : loading ? (
        <WalkLoading />
      ) : null}
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
  // A Take the Speakers read lists before the queue holds its moments: its
  // count alone, not pressable (nothing to open until the moments arrive).
  if (take.waiting > 0 && take.moments.length === 0) {
    return { value, label, subtitle: COPY.momentsWaiting(take.waiting), done: true };
  }
  if (take.waiting > 0) return { value, label, subtitle: COPY.takeWaiting(take.waiting, take.moments.length) };
  // A Take the Speakers read lists carries counts alone, no moments: it reads
  // "All moments answered" (the list's words win over the prototype's "All
  // answered", Q-B4 A).
  const subtitle =
    index === 0 || take.moments.length === 0 ? COPY.allMomentsAnswered : COPY.answeredMoments(take.moments.length);
  return { value, label, subtitle, done: true, mark: "check" };
}

/** A speaker opened from Your speakers before the queue has their moments:
 *  wait for the queue rather than draw Takes that cannot open. Pure. */
export function awaitingMoments(speaker: QueueSpeaker, queueLoading: boolean): boolean {
  return queueLoading && speaker.takes.some((t) => t.waiting > 0 && t.moments.length === 0);
}

export function SpeakerScreen({ speaker, loading = false, onTake, onBack, onClose }: {
  speaker: QueueSpeaker;
  /** The queue is still being read. */
  loading?: boolean;
  onTake: (take: QueueTake) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const takes = takesNewestFirst(speaker.takes);
  return (
    <WalkOverlay
      title={speaker.pseudonym}
      subtitle={speaker.goal ? COPY.goal(speaker.goal) : null}
      onBack={onBack}
      onClose={onClose}
      testId="coach-panel-speaker"
    >
      {awaitingMoments(speaker, loading) ? (
        <WalkLoading />
      ) : (
        <WalkChoices
          label={speaker.pseudonym}
          choices={takes.map(takeChoice)}
          onPick={(v) => {
            const take = takes.find((t) => t.sessionId === v);
            if (take) onTake(take);
          }}
        />
      )}
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

/** What the machine heard, in the signed words only (D-CP-13): an error by
 *  the library's own label, a cue by the kind question's word, "nothing" when
 *  it heard nothing. A reason key (the clearer version's weak read) has no
 *  signed word and shows nothing; so does a cue the copy does not know, and
 *  an error without its label (never a raw key). An older read without
 *  `heard` falls back to the request's spotted errors. Pure. */
export function heardWords(read: Pick<MomentRead, "heard" | "request">): string[] {
  if (!read.heard) return (read.request?.spotted ?? []).map((s) => s.label).filter(Boolean);
  const words: string[] = [];
  for (const h of read.heard) {
    if (h.kind === "error") {
      if (h.label) words.push(h.label);
    }
    else if (h.kind === "cue" && COPY.cue[h.key]) words.push(COPY.cue[h.key]);
    else if (h.kind === "nothing") words.push(COPY.heardNothing);
  }
  return words;
}

/** A clearer-version moment: the request reached the coach as a rewrite, or
 *  all the machine heard is the clearer version's reason. Pure. */
export function isClearerVersion(read: Pick<MomentRead, "heard" | "request">): boolean {
  if (read.request?.kind === "rewrite") return true;
  return !!read.heard && read.heard.length > 0 && read.heard.every((h) => h.kind === "reason");
}

/** The lines: You and the speaker always (an answer not given reads "—", as
 *  the prototype draws it), then The machine heard. That last line is left
 *  out on a clearer-version moment (founder 2026-10-08, Q-CP13a A: never
 *  drawn blank) and wherever the machine's words have no signed word to
 *  show. Pure. */
export function revealLines(
  read: MomentRead,
  pseudonym: string,
  justRated: AnswerValue | null,
): RevealLine[] {
  const lines: RevealLine[] = [
    { label: COPY.you, value: answerWord(justRated ?? read.coachAnswer) ?? COPY.noAnswer },
    { label: pseudonym, value: answerWord(read.speakerAnswer) ?? COPY.noAnswer },
  ];
  if (isClearerVersion(read)) return lines;
  const heard = heardWords(read).join(" · ");
  if (heard) lines.push({ label: COPY.machineHeard, value: heard });
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
