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
  historyRows,
  judgementTone,
  nextOpensPicker,
  overlayFooter,
  practiseCardOf,
  type HistoryRow,
  type Judgement,
  type LabelTone,
  type PractiseCard,
} from "@/lib/willab/paragraphOverlay";
export { coachHasIt, exerciseOf } from "@/lib/willab/paragraphOverlay";
import { PRAISE_LEAD, praiseLines } from "@/lib/willab/trackedChangeWhy";
import MomentPlayer from "./MomentPlayer";
import CoachVideo from "./CoachVideo";
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

function SheetFrame({
  title,
  onClose,
  children,
  footer = null,
  nav = null,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** The walk's ‹ position › header, above the title (founder 2026-09-26). */
  nav?: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 sm:items-center sm:p-6"
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
          <h2 className="text-[22px] font-bold tracking-[-0.01em] text-foreground">
            {title}
          </h2>
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
          <p className="text-[15px] leading-relaxed text-foreground">
            {card.tentative ? COPY.praiseTentative : PRAISE_LEAD}
          </p>
          {praiseLines(card.cueKeys).map((line) => (
            <p key={line} className="text-[15px] leading-relaxed text-foreground">
              {line}
            </p>
          ))}
        </>
      ) : (
        <p className="text-[17px] font-semibold leading-snug text-foreground">
          {card.text}
        </p>
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
  onUse,
  onClose,
}: {
  headline: string | null;
  text: string;
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

/** The word on the one black button that moves on: the walk's Next, Done
 *  on the last moment and outside the walk (Q32 A). */
function moveOnLabel(pager: Pager | null): string {
  const last = !pager || pager.index >= pager.total - 1;
  return last ? COPY.pillDone : COPY.pagerNext;
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
  const rows = useMemo(() => historyRows(history, COPY.historyTake), [history]);
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
  onUseHelperWords,
  onDone = null,
  pager = null,
  slideLabel = null,
  onDocumentChanged = null,
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
  /** Practise the card's exercise: the host opens the judgement sheet on
   *  its exercise step. Absent → no Practise. */
  onPractise?: ((item: DocumentSuggestion, answer: string | null) => void) | null;
  /** Save the tapped words and lock them (Q24 B). Resolves true when both
   *  landed. Absent → no picker. */
  onUseHelperWords?: ((span: RootPhraseSpan) => Promise<boolean>) | null;
  /** The sheet finished on its own — Next, Skip, or the words saved — and
   *  the host moves the walk on. Absent → the sheet closes. */
  onDone?: (() => void) | null;
  /** Back / Next across the Take's bookmarks (founder 2026-09-25). */
  pager?: Pager | null;
  /** Where the paragraph sits ("Slide 2"). */
  slideLabel?: string | null;
  /** The exercise shown here is stale on the server: re-read the document. */
  onDocumentChanged?: (() => void) | null;
  onClose: () => void;
}) {
  // Read ahead by the page (founder 2026-09-28, "1A"): the sheet opens
  // complete instead of drawing the player and then popping in the rest.
  const sheetData = useParagraphSheetData(arcId, takeSessionId, partId);
  const [picking, setPicking] = useState(false);
  const items = useMemo(() => itemsOf(decided, pending), [decided, pending]);
  const moment = items.find(isConfidentVoiceFeedback) ?? null;
  const stored = sheetData?.answers.find((a) => a.feedbackId === moment?.id)?.response ?? null;
  const judgement = asJudgementValue(answer ?? stored);
  const rows = useMemo(
    () => historyRows(sheetData?.history ?? null, COPY.historyTake),
    [sheetData],
  );
  const moveOn = onDone ?? onClose;

  if (picking && onUseHelperWords) {
    return (
      <HelperWordsPicker
        headline={headline}
        text={text}
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
            {moveOnLabel(pager)}
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
  const card = sheetData ? practiseCardOf(items, judgement, text) : null;
  const canPractise = card?.kind === "exercise" && Boolean(onPractise);
  const footer = overlayFooter(judgement, canPractise);
  const practise = () => {
    if (card?.kind === "exercise") onPractise?.(card.item, judgement);
  };
  const next = () => {
    if (nextOpensPicker(judgement, headline) && onUseHelperWords) setPicking(true);
    else moveOn();
  };
  const pill = footer.pill === "practise" ? (
    <button type="button" data-testid="paragraph-sheet-practise" onClick={practise} className={PILL}>
      <Mic className="h-4 w-4" aria-hidden />
      {COPY.pillPractise}
    </button>
  ) : (
    <button type="button" data-testid="paragraph-sheet-next" onClick={next} className={PILL}>
      {nextOpensPicker(judgement, headline) ? COPY.pagerNext : moveOnLabel(pager)}
    </button>
  );
  const link = footer.link === "skip" ? (
    <button type="button" data-testid="paragraph-sheet-skip" onClick={moveOn} className={LINK}>
      {COPY.linkSkip}
    </button>
  ) : footer.link === "practise" ? (
    <button type="button" data-testid="paragraph-sheet-practise" onClick={practise} className={LINK}>
      {COPY.pillPractise}
    </button>
  ) : null;

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
        {history}
      </div>
    </SheetFrame>
  );
}
