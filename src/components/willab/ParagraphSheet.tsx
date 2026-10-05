"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, Mic } from "lucide-react";
import OverlayCloseButton from "@/components/willab/OverlayCloseButton";
import type { DocumentSuggestion } from "@/services/api/idealText";
import type { RootPhraseSpan } from "@/services/api/partLock";
import {
  fetchParagraphHistory,
  type ParagraphHistory,
} from "@/services/api/bookmarkHistory";
import { isConfidentVoiceFeedback } from "@/lib/willab/chunkSteps";
import {
  asJudgementValue,
  belowInBetween,
  canAcceptCard,
  historyRows,
  judgementTone,
  nextOpensPicker,
  overlayFooter,
  practiseCardOf,
  type HistoryRow,
  type Judgement,
  type LabelTone,
  type PractiseCard,
  FEEDBACK_FIRST,
  feedbackFirstCard,
  feedbackFirstFooter,
  machineReadOf,
  type MachineRead,
} from "@/lib/willab/paragraphOverlay";
import { acceptOutcome, saveTakeFeedbackResponse } from "@/services/api/takeFeedback";
export { coachHasIt, exerciseOf } from "@/lib/willab/paragraphOverlay";

/** How Practise was reached (29b): the card as shown; the rewrite just
 *  accepted (the heading says so); or the speaker's own words after "Keep
 *  my words" below In-between. */
export type PractiseMode = "card" | "accepted" | "own";
import { PRAISE_LEAD, praiseLines } from "@/lib/willab/trackedChangeWhy";
import { useGuestBlock } from "./GuestSignUpDialog";
import MomentPlayer from "./MomentPlayer";
import CoachVideo from "./CoachVideo";
import HelperWordsSheet from "./HelperWordsSheet";
import { useParagraphSheetData } from "./paragraphSheetData";
import {
  canTap,
  nextSelection,
  phraseTokens,
  selectionLength,
  selectionSpan,
  type PhraseSelection,
} from "@/lib/willab/phraseTokens";
import { CHUNK_SHEET_COPY as COPY } from "./idealEditCopy";
import { FeedbackPagerBar, type Pager } from "./feedbackPager";
import { useExerciseRenderedAck } from "@/hooks/useExerciseRenderedAck";

/* -------------------------------------------------------------------------- */
/*  THE PARAGRAPH'S OWN SHEET (founder lock 2026-09-30, B5, B8, D6, D7, Q1).  */
/*                                                                            */
/*  Exactly two states, and never the paragraph text — the words are on the   */
/*  page behind it (D6):                                                      */
/*                                                                            */
/*    PRACTISE  the player, "Your judgement: …" as one small tinted line,    */
/*              one main practise card (a rewrite, a praise, or an exercise   */
/*              with its video inside), one collapsed History row, and the    */
/*              button: Practise with Skip under it on a No or Not sure,      */
/*              Next on a Yes or In-between (Practise as the link on          */
/*              In-between, Q1 B). Next after a Yes or In-between opens the   */
/*              helper-words picker (24e); a locked paragraph opens on the    */
/*              other state.                                                  */
/*    SAVED     "Helper words saved": the player, the words, History, Next.   */
/*              Nothing to judge and nothing to practise (B8); the walk       */
/*              passes it with Next.                                          */
/*                                                                            */
/*  Opens from a tap on the paragraph, and from the judgement sheet the       */
/*  moment an answer is given (the hand-off). Its own component so the        */
/*  judgement sheet — grandfathered at the complexity ratchet — gains no      */
/*  branch. Words only (AC-9); the label is the owner's own answer (L3).      */
/*  Every string is signed copy (B9).                                         */
/* -------------------------------------------------------------------------- */

const EYEBROW =
  "text-[11px] uppercase tracking-[0.13em] text-muted-foreground";
const PILL =
  "flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-foreground px-5 text-[16px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50";
const LINK =
  "flex min-h-[48px] w-full items-center justify-center text-[16px] font-normal text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50";

export function SheetFrame({
  title,
  onClose,
  children,
  footer = null,
  nav = null,
  railed = false,
  note = null,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** A grey line under the title (the Take 1 note on the picker). */
  note?: ReactNode;
  /** The walk's ‹ position › header, above the title (founder 2026-09-26). */
  nav?: ReactNode;
  /** The coach's desktop rail sits on the left from 1024px (P2-14); the
   *  sheet centres in what is left. Never set on a speaker's sheet. */
  railed?: boolean;
}) {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 sm:items-center sm:p-6${
        railed ? " lg:pl-[276px]" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="paragraph-sheet"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        className="flex h-[97dvh] max-h-[97dvh] w-full max-w-lg flex-col rounded-t-3xl bg-background shadow-xl sm:h-[94vh] sm:max-h-[94vh] sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        {nav ? <div className="shrink-0 pt-3">{nav}</div> : null}
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-5">
          <div className="min-w-0">
            <h2 className="text-[22px] font-bold tracking-[-0.01em] text-foreground">
              {title}
            </h2>
            {note ? (
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{note}</p>
            ) : null}
          </div>
          <OverlayCloseButton onClick={onClose} ariaLabel="Close" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-6 pt-2">
          {children}
        </div>
        {footer ? <div className="shrink-0 px-5 pb-6 pt-2">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ---- the judgement label (D7) ------------------------------------------- */

/** Tint behind, full colour on the text. The five colours are the speaker's
 *  own five answers; the machine's read has no colour here. Written as
 *  arbitrary values so the palette needs no new token. */
const TONE_CLASS: Record<LabelTone, string> = {
  green: "bg-affirm/15 text-affirm",
  blue: "bg-[hsl(214_80%_50%/0.14)] text-[hsl(214_70%_38%)]",
  red: "bg-destructive/15 text-destructive",
  yellow: "bg-[hsl(44_92%_50%/0.2)] text-[hsl(40_80%_30%)]",
  grey: "bg-muted text-muted-foreground",
};

function JudgementLabel({ judgement }: { judgement: Judgement | null }) {
  if (!judgement) return null;
  const tone = judgementTone(judgement);
  return (
    <p
      data-testid="judgement-label"
      data-tone={tone}
      className={`flex items-baseline gap-1.5 self-start rounded-lg px-2.5 py-1 text-[13px] font-semibold ${TONE_CLASS[tone]}`}
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.1em] opacity-75">
        {COPY.judgementLabel}
      </span>
      {COPY.judgementWord[judgement]}
    </p>
  );
}

/* ---- the practise card (B5) --------------------------------------------- */

/** MLC-3 §3.5: an exercise card confirms it rendered once half visible;
 *  nothing is shown. Its own component so the hook runs only when the card
 *  is an exercise. */
function ExerciseCardBody({
  card,
  onStale,
}: {
  card: Extract<PractiseCard, { kind: "exercise" }>;
  onStale: (() => void) | null;
}) {
  const seen = useExerciseRenderedAck(card.item, onStale);
  return (
    <div ref={seen} data-testid="answered-exercise" className="flex flex-col gap-3">
      {card.video ? <CoachVideo src={card.video} /> : null}
      {card.instruction ? (
        <p className="text-[15px] leading-relaxed text-foreground">{card.instruction}</p>
      ) : null}
      <p className="text-[17px] font-semibold leading-snug text-foreground">
        {card.passage}
      </p>
    </div>
  );
}

function cardEyebrow(card: PractiseCard): string {
  switch (card.kind) {
    case "exercise":
      return COPY.titleExercise;
    case "rewrite":
      return COPY.cardClearerVersion;
    case "praise":
      return COPY.titlePraise;
    default:
      return COPY.cardSayItAgain;
  }
}

function PractiseCardView({
  card,
  onStale,
}: {
  card: PractiseCard | null;
  onStale: (() => void) | null;
}) {
  if (!card) return null;
  return (
    <div
      data-testid="practise-card"
      data-kind={card.kind}
      className="flex flex-col gap-3 rounded-2xl border border-pending/40 bg-pending/[0.08] p-4"
    >
      <p className={EYEBROW}>{cardEyebrow(card)}</p>
      {card.kind === "exercise" ? (
        <ExerciseCardBody card={card} onStale={onStale} />
      ) : card.kind === "praise" ? (
        <>
          <p className="text-[17px] font-semibold leading-snug text-foreground">
            {card.text}
          </p>
          {/* THE SIGNED LINE WINS (35f): the catalogue's sentence for this
              praise, when one exists; else the constant lead and the line
              per cue. */}
          {card.line ? (
            <p data-testid="praise-line" className="text-[15px] leading-relaxed text-foreground">
              {card.line}
            </p>
          ) : (
            <>
              <p className="text-[15px] leading-relaxed text-foreground">
                {card.tentative ? COPY.praiseTentative : PRAISE_LEAD}
              </p>
              {praiseLines(card.cueKeys).map((line) => (
                <p key={line} className="text-[15px] leading-relaxed text-foreground">
                  {line}
                </p>
              ))}
            </>
          )}
        </>
      ) : (
        <>
          <p className="text-[17px] font-semibold leading-snug text-foreground">
            {card.text}
          </p>
          {card.kind === "rewrite" && card.move ? (
            <p data-testid="rewrite-move" className="text-[15px] leading-relaxed text-foreground">
              {card.move}
            </p>
          ) : null}
        </>
      )}
      {card.kind === "plain" && card.coach ? (
        /* WHERE PRACTISE WOULD SIT (founder 2026-09-29; kept by Q5): the
           bookmark went to the coach and no exercise has come back yet. */
        <p data-testid="coach-request-line" className="text-[14px] font-semibold text-foreground">
          {COPY.coachWorkingOnExercise}
        </p>
      ) : null}
    </div>
  );
}

/* ---- accept the rewrite (29b) ------------------------------------------- */

/** ACCEPT AND PRACTISE (founder 2026-09-30, C11; contract 29b): the owner's
 *  `apply_suggestion` response, then the host's decision on the document,
 *  then the practise on the accepted words. A failed write says so and
 *  leaves the card as it was. */
function useAcceptRewrite(
  card: PractiseCard | null,
  moment: DocumentSuggestion | null,
  judgement: Judgement | null,
  onAccept: ((item: DocumentSuggestion) => Promise<boolean>) | null,
  onPractise: ((
    item: DocumentSuggestion,
    answer: string | null,
    mode?: PractiseMode,
    card?: PractiseCard,
  ) => void) | null | undefined,
) {
  const [accepting, setAccepting] = useState(false);
  const [failed, setFailed] = useState(false);
  const guestBlock = useGuestBlock();
  const accept = async () => {
    if (guestBlock()) return;
    if (!card || card.kind !== "rewrite" || !moment || !onAccept || accepting) return;
    setAccepting(true);
    setFailed(false);
    const item = card.item;
    const saved = item.takeSessionId && item.feedbackFamily
      ? await saveTakeFeedbackResponse({
          takeSessionId: item.takeSessionId,
          feedbackId: item.id,
          feedbackFamily: item.feedbackFamily,
          response: "apply_suggestion",
          candidateId: item.candidateId,
          feedbackMembershipId: item.feedbackMembershipId,
          feedbackExposureId: item.feedbackExposureId,
        })
      : { ok: true as const };
    const outcome = saved.ok ? acceptOutcome(saved.textUpdate) : "refused";
    const applied = outcome === "refused"
      ? false
      : await onAccept(outcome === "server" ? { ...item, acceptedOnServer: true } : item);
    setAccepting(false);
    if (!saved.ok || !applied) {
      setFailed(true);
      return;
    }
    // The card as it was: the accept reassembles the document and the
    // served rewrite may leave the paragraph, but the words to say are
    // the ones just accepted.
    onPractise?.(moment, judgement, "accepted", card);
  };
  return { accept, accepting, failed };
}

/** Before any judgement on a waiting moment (24e-1; Phase 6): the machine's
 *  read of it, which chooses the card and the button; undefined otherwise. */
function openingOf(
  awaiting: { onJudge: () => void; onSkip: () => void } | null,
  judgement: Judgement | null,
  items: readonly DocumentSuggestion[],
): { read: MachineRead } | undefined {
  if (!FEEDBACK_FIRST || !awaiting || judgement !== null) return undefined;
  return { read: machineReadOf(items) };
}

function cardAt(
  opening: { read: MachineRead } | undefined,
  items: readonly DocumentSuggestion[],
  judgement: Judgement | null,
  text: string,
): PractiseCard | null {
  return opening
    ? feedbackFirstCard(items, opening.read, text)
    : practiseCardOf(items, judgement, text);
}

/** Accept on the card before any judgement too (29b; 24e-1). */
function acceptableAt(
  opening: { read: MachineRead } | undefined,
  card: PractiseCard | null,
  judgement: Judgement | null,
  hasHost: boolean,
): boolean {
  return canAcceptCard(card, opening ? "no" : judgement, hasHost);
}

/** Before any judgement Next asks it and Skip settles the moment unanswered
 *  (24e-1); after it, as before. */
function actionsAt(
  opening: { read: MachineRead } | undefined,
  awaiting: { onJudge: () => void; onSkip: () => void } | null,
  next: () => void,
  moveOn: () => void,
): { next: () => void; skip: () => void } {
  if (!opening || !awaiting) return { next, skip: moveOn };
  return { next: awaiting.onJudge, skip: awaiting.onSkip };
}

function footerAt(
  opening: { read: MachineRead } | undefined,
  judgement: Judgement | null,
  canPractise: boolean,
  canAccept: boolean,
): ReturnType<typeof overlayFooter> {
  return opening
    ? feedbackFirstFooter(opening.read, canPractise, canAccept)
    : overlayFooter(judgement, canPractise, canAccept);
}

/** The one black button (B5 as overridden; 29b). */
function FooterPill({
  pill,
  accepting,
  nextLabel,
  onAccept,
  onPractise,
  onNext,
}: {
  pill: "next" | "practise" | "accept";
  accepting: boolean;
  nextLabel: string;
  onAccept: () => void;
  onPractise: () => void;
  onNext: () => void;
}) {
  if (pill === "accept") {
    return (
      <button
        type="button"
        data-testid="paragraph-sheet-accept"
        onClick={onAccept}
        disabled={accepting}
        className={PILL}
      >
        {accepting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {COPY.pillAcceptPractise}
      </button>
    );
  }
  if (pill === "practise") {
    return (
      <button type="button" data-testid="paragraph-sheet-practise" onClick={onPractise} className={PILL}>
        <Mic className="h-4 w-4" aria-hidden />
        {COPY.pillPractise}
      </button>
    );
  }
  return (
    <button type="button" data-testid="paragraph-sheet-next" onClick={onNext} className={PILL}>
      {nextLabel}
    </button>
  );
}

/** The grey link under the pill (B5 as overridden; 29b). */
function FooterLink({
  link,
  onSkip,
  onPractise,
  onKeep,
}: {
  link: "skip" | "practise" | "keep" | null;
  onSkip: () => void;
  onPractise: () => void;
  onKeep: () => void;
}) {
  if (link === "skip") {
    return (
      <button type="button" data-testid="paragraph-sheet-skip" onClick={onSkip} className={LINK}>
        {COPY.linkSkip}
      </button>
    );
  }
  if (link === "practise") {
    return (
      <button type="button" data-testid="paragraph-sheet-practise" onClick={onPractise} className={LINK}>
        {COPY.pillPractise}
      </button>
    );
  }
  if (link === "keep") {
    return (
      <button type="button" data-testid="paragraph-sheet-keep" onClick={onKeep} className={LINK}>
        {COPY.linkKeepMyWords}
      </button>
    );
  }
  return null;
}

/* ---- the saved words (state two) ---------------------------------------- */

function HelperWordsCard({
  headline,
  onChoose,
}: {
  headline: string;
  onChoose: (() => void) | null;
}) {
  return (
    <div
      data-testid="paragraph-helper-card"
      className="flex flex-col gap-1 rounded-2xl border border-pending/40 bg-pending/[0.08] p-4"
    >
      <span className={EYEBROW}>{COPY.historyHelperWords}</span>
      <p className="text-[20px] font-bold leading-snug text-primary">{headline}</p>
      {onChoose ? (
        <button
          type="button"
          data-testid="paragraph-helper-words"
          onClick={onChoose}
          className="self-start text-[14px] font-semibold text-primary transition-opacity hover:opacity-70"
        >
          {COPY.pillChooseWords}
        </button>
      ) : null}
    </div>
  );
}

/* ---- History, one collapsed row (Q1) ------------------------------------ */

function HistoryRowView({ rows }: { rows: readonly HistoryRow[] }) {
  return (
    <details data-testid="paragraph-history" className="group rounded-lg bg-muted/60 px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-semibold text-muted-foreground">
        <span>{COPY.historyRow}</span>
        <span className="transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      {rows.length > 0 ? (
        <ol className="mt-2 flex flex-col gap-1">
          {rows.map((row, index) => (
            <li
              key={`${row.label}-${index}`}
              className="flex flex-wrap items-baseline gap-x-2 text-[13px] text-foreground"
            >
              <span className="font-semibold">{row.label}</span>
              {row.answer ? <span>{COPY.judgementWord[row.answer]}</span> : null}
              {row.helperWords ? (
                <span className="font-semibold text-primary">{row.helperWords}</span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </details>
  );
}

/* ---- the picker (Q27 B, B3) ---------------------------------------------- */

/** A tapped word previews in the accent; a word a tap cannot reach under
 *  the four-word cap reads muted (founder lock 2026-09-30, B3). */
function tokenTone(picked: boolean, reachable: boolean): string {
  if (picked) return "bg-primary/10 text-primary";
  return reachable ? "text-foreground" : "text-muted-foreground/60";
}

function HelperWordsPicker({
  headline,
  text,
  firstTake,
  onUse,
  onClose,
}: {
  headline: string | null;
  text: string;
  /** Take 1: the note under the title says where the words will show
   *  (founder 2026-10-05, N48.3 Q8 A; the Feedback sheet's own line). */
  firstTake: boolean;
  onUse: (span: RootPhraseSpan) => Promise<boolean>;
  onClose: () => void;
}) {
  const tokens = useMemo(() => phraseTokens(text), [text]);
  const [run, setRun] = useState<PhraseSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const span = selectionSpan(text, tokens, run);

  async function use() {
    if (!span || busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await onUse(span);
    setBusy(false);
    if (ok) onClose();
    else setFailed(true);
  }

  return (
    <SheetFrame
      title={COPY.titleEmphasis}
      note={firstTake ? COPY.emphasisFirstTakeNote : null}
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={!span || busy}
          onClick={() => void use()}
          className={PILL}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {COPY.pillEmphasise}
        </button>
      }
    >
      {headline ? (
        <div className="flex flex-col gap-1 rounded-2xl border border-pending/40 bg-pending/[0.08] p-4">
          <span className={EYEBROW}>
            {COPY.historyHelperWords} · {COPY.historyNow}
          </span>
          <span className="text-[16px] font-bold leading-snug text-primary">
            {headline}
          </span>
        </div>
      ) : null}
      <div className="rounded-2xl border border-border px-3 py-4">
        <p className={EYEBROW}>
          {COPY.cardTapWords} · {COPY.emphasisCount(selectionLength(run))}
        </p>
        <div className="mt-2 flex flex-wrap gap-0.5" data-testid="picker-tokens">
          {tokens.map((token, index) => {
            const picked = run !== null && index >= run.from && index <= run.to;
            const reachable = canTap(run, index);
            return (
              <button
                key={`${token.start}-${token.text}`}
                type="button"
                aria-pressed={picked}
                disabled={!reachable}
                onClick={() => setRun(nextSelection(run, index))}
                className={`inline-flex min-h-[44px] items-center rounded-lg px-1.5 text-[15px] leading-tight transition-colors ${tokenTone(picked, reachable)}`}
              >
                {token.text}
              </button>
            );
          })}
        </div>
      </div>
      {failed ? (
        <p className="rounded-xl border border-border p-3 text-[13px] text-destructive">
          {COPY.failRoot}
        </p>
      ) : null}
    </SheetFrame>
  );
}

/* ---- the walk's chrome --------------------------------------------------- */

/** ‹ Slide 2 › over the sheet. In the walk it is the walk's own bar with the
 *  slide as its whole text; outside the walk the slide alone, centred. */
function OverlayNav({
  pager,
  slideLabel,
}: {
  pager: Pager | null;
  slideLabel: string | null;
}): ReactNode {
  if (pager) {
    return <FeedbackPagerBar pager={{ ...pager, position: pager.label ?? slideLabel ?? undefined }} />;
  }
  if (!slideLabel) return null;
  return (
    <p
      data-testid="paragraph-sheet-slide"
      className="px-3 pt-1 text-center text-[13px] font-semibold text-foreground"
    >
      {slideLabel}
    </p>
  );
}

/** Whose history to show under the coach's work (the coaching sheet). */
export interface HistoryTarget {
  arcId: string | null;
  partId: string;
  text: string;
  headline: string | null;
}

/** A done bookmark's history, for the coaching sheet (founder 2026-09-25):
 *  the helper words now, then the History row. */
export function ParagraphHistoryBlock({ arcId, partId, headline }: HistoryTarget) {
  const [history, setHistory] = useState<ParagraphHistory | null>(null);
  useEffect(() => {
    let alive = true;
    if (arcId) {
      void fetchParagraphHistory(arcId, partId).then((result) => {
        if (alive) setHistory(result);
      });
    }
    return () => {
      alive = false;
    };
  }, [arcId, partId]);
  const rows = useMemo(
    () => historyRows(history, COPY.historyTake, COPY.historyCorrectionAccepted),
    [history],
  );
  return (
    <div className="flex flex-col gap-4" data-testid="bundle-history">
      {headline ? <HelperWordsCard headline={headline} onChoose={null} /> : null}
      <HistoryRowView rows={rows} />
    </div>
  );
}

/** The items on this paragraph, once each: the answered ones and the ones
 *  still open (a rewrite or a praise rides its moment and is never decided
 *  on its own any more). */
function itemsOf(
  decided: readonly DocumentSuggestion[],
  pending: readonly DocumentSuggestion[],
): DocumentSuggestion[] {
  const seen = new Set<string>();
  return [...decided, ...pending].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export default function ParagraphSheet({
  arcId,
  takeSessionId,
  partId,
  text,
  headline,
  decided,
  pending = [],
  answer = null,
  onPractise,
  onAccept = null,
  practiseEveryCard = false,
  practiseOff = false,
  awaiting = null,
  onUseHelperWords,
  helperWordsHost = null,
  startPicking = false,
  onDone = null,
  pager = null,
  slideLabel = null,
  onDocumentChanged = null,
  firstTake = false,
  onClose,
}: {
  arcId: string | null;
  takeSessionId: string | null;
  partId: string;
  /** The paragraph as it is now. Never drawn (D6); the picker taps it. */
  text: string;
  /** The paragraph's saved helper words, joined " · " — or null. With
   *  them the sheet is the SAVED state (B8). */
  headline: string | null;
  /** The answered items on this paragraph. */
  decided: readonly DocumentSuggestion[];
  /** The items still open on it: the rewrite or praise riding the moment. */
  pending?: readonly DocumentSuggestion[];
  /** The answer just given in the judgement sheet (the hand-off), before
   *  the server's read of it lands. Null: the stored answer is read. */
  answer?: string | null;
  /** Practise the card: the host opens the practise loop. Absent → no
   *  Practise. */
  onPractise?: ((
    item: DocumentSuggestion,
    answer: string | null,
    mode?: PractiseMode,
    card?: PractiseCard,
  ) => void) | null;
  /** ACCEPT THE REWRITE (founder 2026-09-30, C11; contract 29b): the host
   *  records the decision on the document (the ledger bakes it; a new
   *  version). The sheet writes the owner's `apply_suggestion` response
   *  first. Absent → the rewrite is a passage to practise, never accepted. */
  onAccept?: ((item: DocumentSuggestion) => Promise<boolean>) | null;
  /** The host runs the practise loop for every kind of card (founder lock
   *  2026-09-30, B6: the exercise, the rewrite and the plain moment all
   *  reach the same screens). Without it only an exercise can be
   *  practised — the host then opens the judgement sheet's exercise step. */
  practiseEveryCard?: boolean;
  /** Personalised practice is off (F1 Repair Plan Phase 4): no Practise on
   *  any card, and so no "Accept and practise" either -- its one button
   *  promises the practise. The footer is the no-practise one (Next). */
  practiseOff?: boolean;
  /** JUDGEMENT AFTER FEEDBACK (24e-1; Phase 6): the moment is still waiting
   *  for the speaker. The sheet opens on the machine's feedback; `onJudge`
   *  asks the judgement (Next on a confident moment), `onSkip` settles the
   *  moment without one. */
  awaiting?: { onJudge: () => void; onSkip: () => void } | null;
  /** Save the tapped words and lock them (Q24 B). Resolves true when both
   *  landed. Absent → no picker. */
  onUseHelperWords?: ((span: RootPhraseSpan) => Promise<boolean>) | null;
  /** THE HELPER WORDS OVERLAY (founder lock 2026-09-30, B4): with a host,
   *  "Edit" on the saved state opens the overlay with
   *  the Take chips and Delete; without one, the picker over the current
   *  words. */
  helperWordsHost?: {
    onUseFromTake: (phrase: string, takeIndex: number) => Promise<boolean>;
    onDelete: () => Promise<boolean>;
  } | null;
  /** Open straight on the helper words (the page's headline was tapped). */
  startPicking?: boolean;
  /** The sheet finished on its own — Next, Skip, or the words saved — and
   *  the host moves the walk on. Absent → the sheet closes. */
  onDone?: (() => void) | null;
  /** Back / Next across the Take's bookmarks (founder 2026-09-25). */
  pager?: Pager | null;
  /** Where the paragraph sits ("Slide 2"). */
  slideLabel?: string | null;
  /** The exercise shown here is stale on the server: re-read the document. */
  onDocumentChanged?: (() => void) | null;
  /** The project has exactly one Take: the picker says where the helper
   *  words will show up. */
  firstTake?: boolean;
  onClose: () => void;
}) {
  // Read ahead by the page (founder 2026-09-28, "1A"): the sheet opens
  // complete instead of drawing the player and then popping in the rest.
  const sheetData = useParagraphSheetData(arcId, takeSessionId, partId);
  const [picking, setPicking] = useState(startPicking);
  const items = useMemo(() => itemsOf(decided, pending), [decided, pending]);
  const moment = items.find(isConfidentVoiceFeedback) ?? null;
  const stored = sheetData?.answers.find((a) => a.feedbackId === moment?.id)?.response ?? null;
  const judgement = asJudgementValue(answer ?? stored);
  const rows = useMemo(
    () =>
      historyRows(
        sheetData?.history ?? null,
        COPY.historyTake,
        COPY.historyCorrectionAccepted,
      ),
    [sheetData],
  );
  const moveOn = onDone ?? onClose;
  const practiseHandler = practiseOff ? null : onPractise;
  // Hooks before any early return (the picker and the saved state return
  // above the practise state, and a hook after them renders fewer hooks).
  const opening = openingOf(awaiting, judgement, items);
  const card = sheetData ? cardAt(opening, items, judgement, text) : null;
  const { accept, accepting, failed: acceptFailed } =
    useAcceptRewrite(card, moment, judgement, onAccept, practiseHandler);

  if (picking && onUseHelperWords && helperWordsHost && headline) {
    return (
      <HelperWordsSheet
        headline={headline}
        currentText={text}
        history={sheetData?.history ?? null}
        onUseCurrent={onUseHelperWords}
        onUseFromTake={helperWordsHost.onUseFromTake}
        onDelete={helperWordsHost.onDelete}
        onDone={() => {
          setPicking(false);
          moveOn();
        }}
        nav={<OverlayNav pager={pager} slideLabel={slideLabel} />}
        onClose={onClose}
      />
    );
  }
  if (picking && onUseHelperWords) {
    return (
      <HelperWordsPicker
        headline={headline}
        text={text}
        firstTake={firstTake}
        onUse={onUseHelperWords}
        onClose={() => {
          setPicking(false);
          moveOn();
        }}
      />
    );
  }

  const nav = <OverlayNav pager={pager} slideLabel={slideLabel} />;
  const player = <MomentPlayer item={moment} compact />;
  const history = <HistoryRowView rows={rows} />;

  /* STATE TWO — SAVED (B8, D6): the words, the player, History, Next. No
     judgement and no practise card. */
  if (headline) {
    return (
      <SheetFrame
        title={COPY.titleSaved}
        onClose={onClose}
        nav={nav}
        footer={
          <button type="button" data-testid="paragraph-sheet-next" onClick={moveOn} className={PILL}>
            {/* "Next" everywhere, on the walk's last screen and outside the
                walk too (founder 2026-10-05, N48.3 Q8 A; lock D10). */}
            {COPY.pagerNext}
          </button>
        }
      >
        <div data-testid="overlay-saved" className="flex flex-col gap-4">
          {player}
          <HelperWordsCard
            headline={headline}
            onChoose={onUseHelperWords ? () => setPicking(true) : null}
          />
          {history}
        </div>
      </SheetFrame>
    );
  }

  /* STATE ONE — PRACTISE (B5, D1, D7). While the read-ahead has not landed
     the same frame draws with the player and the button (audit 2026-09-29:
     a tap always opens something), and the label, the card and History fill
     in when the reads land. */
  const canPractise =
    Boolean(practiseHandler) && Boolean(moment) && card !== null &&
    (practiseEveryCard || card.kind === "exercise");
  const canAccept = canPractise && acceptableAt(opening, card, judgement, Boolean(onAccept));
  const footer = footerAt(opening, judgement, canPractise, canAccept);
  // The card shown is the card practised: before any judgement (24e-1) the
  // host could not re-derive it from the answer.
  const practise = () => {
    if (card && moment) practiseHandler?.(moment, judgement, undefined, card);
  };
  const pickerNext = () => {
    if (nextOpensPicker(judgement, headline) && onUseHelperWords) setPicking(true);
    else moveOn();
  };
  const { next, skip } = actionsAt(opening, awaiting, pickerNext, moveOn);
  /* KEEP MY WORDS (29b): on an In-between, Next as before; below it, the
     practise on the speaker's own words. */
  const keep = () => {
    if (judgement === "in_between" || !moment) next();
    else practiseHandler?.(moment, judgement, "own");
  };
  const pill = (
    <FooterPill
      pill={footer.pill}
      accepting={accepting}
      nextLabel={COPY.pagerNext}
      onAccept={() => void accept()}
      onPractise={practise}
      onNext={next}
    />
  );
  const link = (
    <FooterLink link={footer.link} onSkip={skip} onPractise={practise} onKeep={keep} />
  );

  return (
    <SheetFrame
      title={COPY.titleParagraph}
      onClose={onClose}
      nav={nav}
      footer={
        <div className="flex flex-col gap-0.5">
          {pill}
          {link}
        </div>
      }
    >
      <div
        data-testid={sheetData ? "overlay-practise" : "paragraph-sheet-loading"}
        className="flex flex-col gap-4"
      >
        {player}
        <JudgementLabel judgement={judgement} />
        <PractiseCardView card={card} onStale={onDocumentChanged} />
        {acceptFailed ? (
          <p role="alert" className="text-[14px] text-destructive">{COPY.failApply}</p>
        ) : null}
        {history}
      </div>
    </SheetFrame>
  );
}
