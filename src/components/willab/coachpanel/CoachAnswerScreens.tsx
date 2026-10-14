"use client";

/* -------------------------------------------------------------------------- */
/*  The coach panel's answer screens (founder lock 2026-10-06, the coach      */
/*  panel redrawn, flow steps 6 to 13; prototype screens diagnose, nameerr,   */
/*  decide, swap, exdetail, words, video, kind, share, summary, takeword and  */
/*  takevideo), drawn from the Feedback walk's primitives:                    */
/*                                                                            */
/*    DiagnoseScreen   What kind of error is it? The machine-heard errors     */
/*                     first, marked; Something else · Name a new error; I    */
/*                     don't hear an error                                    */
/*    NameErrorScreen  Name the error: one field                              */
/*    DecideScreen     Choose exercise (Keep it with Details, Swap it, Make a */
/*                     new one, Nothing to add) or What will you do? (Answer, */
/*                     Nothing to add)                                        */
/*    SwapScreen       the exercises for the diagnosed error, each with       */
/*                     Details; Use this one; Make a new one                  */
/*    DetailScreen     one exercise: its video, its instruction, what it     */
/*                     treats; Use this one; Back to the list                 */
/*    WordsScreen      the speaker's passage and player, the coach's words   */
/*                     below with the grey picture and the pencil             */
/*    VideoScreen      Record (one action), Stop, Keep, Record again          */
/*    KindScreen       What did {p} do well? / What kind of fix is it?        */
/*    ShareScreen      Ready for {p}: exactly what the speaker will get       */
/*    SummaryScreen    an answered moment: what happened and Your answer      */
/*    TakeWordScreen   A word for this Take, with the pencil                  */
/*    TakeVideoScreen  its video; Send to {p} or Send without a video         */
/*                                                                            */
/*  Presentational: the host (CoachAnswerFlow) owns the reads and the writes. */
/*  Every word comes from COACH_PANEL_COPY or from the data; no number about  */
/*  a speaker anywhere (AC-9).                                                */
/* -------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import WalkOverlay, { type WalkNav } from "../walk/WalkOverlay";
import WalkFooter, { type WalkAction } from "../walk/WalkFooter";
import WalkChoices, { choiceClass, type WalkChoice } from "../walk/WalkChoices";
import WalkLoading from "../walk/WalkLoading";
import { WalkAvatar } from "../walk/WalkMessage";
import CoachVideo from "../CoachVideo";
import CoachWords from "./CoachWords";
import CoachVideoBox from "./CoachVideoBox";
import type { CoachVideoRecorder } from "@/hooks/useCoachVideoRecorder";
import type { MomentKind } from "@/lib/willab/coachWalk";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";
import type { ErrorChoice } from "@/services/api/coachPanel";

/** What every moment screen shares: its bar and the way out. */
type Frame = { nav: WalkNav; onClose: () => void };

function Fail({ text }: { text: string | null }) {
  return text ? <p role="alert" className="m-0 pb-2 text-center text-[14px] text-destructive">{text}</p> : null;
}

/** The coach's words where the speaker reads them, not editable here. */
export function CoachMessage({ children }: { children: ReactNode }) {
  return (
    <div data-coach-message className="flex items-start gap-2.5 text-[17px] leading-[1.55] text-foreground">
      <WalkAvatar coach />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">{children}</div>
    </div>
  );
}

/** The clearer version's card, as the speaker's walk draws it. */
export function ClearerWords({ text }: { text: string }) {
  return (
    <>
      <span>{COPY.clearerOffer}</span>
      <span data-walk-new-words className="text-[18px] font-semibold leading-[1.45] text-primary">{text}</span>
      <span>{COPY.clearerAsk}</span>
    </>
  );
}

/* ── a list whose rows may carry Details ────────────────────────────── */

export type Row = {
  value: string;
  label: string;
  subtitle?: string | null;
  /** The shade, by the prototype's own tone: 0 white … 3 the darkest. */
  tone: number;
  selected?: boolean;
  onDetails?: () => void;
};

function Rows({ rows, label, onPick }: { rows: readonly Row[]; label: string; onPick: (value: string) => void }) {
  return (
    <div role="group" aria-label={label} data-walk-choices className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.value} data-walk-choice={row.value}
          className={cn("flex items-center gap-2 rounded-2xl border-[1.5px] py-1.5 pl-3.5 pr-2", choiceClass({ selected: row.selected }, row.tone))}>
          <button type="button" onClick={() => onPick(row.value)} aria-pressed={row.selected}
            className="walk-press flex min-w-0 flex-1 items-center justify-between gap-2.5 py-[7px] text-left">
            <span className="min-w-0">
              <b className="block text-[16px] font-semibold text-foreground">{row.label}</b>
              {row.subtitle ? <small className="mt-px block text-[13.5px] text-foreground">{row.subtitle}</small> : null}
            </span>
            {row.onDetails ? null : <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] flex-none text-foreground" />}
          </button>
          {row.onDetails ? (
            <button type="button" onClick={row.onDetails} data-coach-details
              className="walk-press flex-none rounded-full border-[1.5px] border-border bg-background px-3 py-[5px] text-[13.5px] font-semibold">
              {COPY.details}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ── What kind of error is it? ─────────────────────────────────────── */

export function DiagnoseScreen({ nav, onClose, errors, picked, noError, busy, fail, onPick, onName, onNoError }: Frame & {
  /** null while it loads. */
  errors: readonly ErrorChoice[] | null;
  /** The error diagnosed, by id. */
  picked: string | null;
  noError: boolean;
  busy: boolean;
  fail: string | null;
  onPick: (choice: ErrorChoice) => void;
  onName: () => void;
  onNoError: () => void;
}) {
  const choices: WalkChoice[] = [
    ...(errors ?? []).map((e) => ({
      value: `${e.kind}:${e.id}`, label: e.label, subtitle: e.machineHeard ? COPY.machineHeardThis : null, selected: picked === e.id,
    })),
    { value: "else", lead: COPY.somethingElse, label: COPY.nameANewError, variant: "else" as const },
    { value: "noerr", label: COPY.noError, variant: "noerr" as const, selected: noError },
  ];
  return (
    <WalkOverlay nav={nav} title={COPY.whatKindOfError} onClose={onClose} testId="coach-panel-diagnose"
      footer={fail ? <WalkFooter><Fail text={fail} /></WalkFooter> : null}>
      {errors === null ? <WalkLoading /> : (
        <WalkChoices label={COPY.whatKindOfError} choices={choices} onPick={(v) => {
          if (busy) return;
          if (v === "else") onName();
          else if (v === "noerr") onNoError();
          else {
            const choice = errors.find((e) => `${e.kind}:${e.id}` === v);
            if (choice) onPick(choice);
          }
        }} />
      )}
    </WalkOverlay>
  );
}

/* ── Name the error ───────────────────────────────────────────────── */

export function NameErrorScreen({ nav, onClose, pseudonym, value, busy, fail, onChange, onNext }: Frame & {
  pseudonym: string;
  value: string;
  busy: boolean;
  fail: string | null;
  onChange: (value: string) => void;
  onNext: () => void;
}) {
  return (
    <WalkOverlay nav={nav} title={COPY.nameTheError} subtitle={COPY.nameTheErrorHint} onClose={onClose} testId="coach-panel-nameerr"
      footer={<WalkFooter pill={{ label: COPY.next, onClick: onNext, disabled: busy || !value.trim(), testId: "coach-panel-nameerr-next" }}><Fail text={fail} /></WalkFooter>}>
      <input data-testid="coach-panel-nameerr-field" aria-label={COPY.nameTheError} value={value} placeholder={COPY.nameTheErrorPlaceholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[14px] border-[1.5px] border-border bg-background p-3.5 text-[17px] text-foreground outline-none focus:border-foreground" />
      <p className="m-0 text-[14.5px] text-muted-foreground">{COPY.nameTheErrorNote(pseudonym)}</p>
    </WalkOverlay>
  );
}

/* ── Choose exercise / What will you do? ───────────────────────────── */

/** The rows of the choice, as the prototype's decide() draws them. Pure. */
export function decideRows(input: {
  /** An error the coach hears: the exercise choice; else the answer. */
  asError: boolean;
  kind: MomentKind;
  /** The served exercise, when it treats the diagnosed error. */
  served: { id: string; title: string } | null;
  /** How many more exercises in the library treat it. */
  others: number;
  errorLabel: string;
  onDetails: (id: string) => void;
}): Row[] {
  const nothing: Row = { value: "nothing", label: COPY.nothingToAdd, tone: 3 };
  if (!input.asError) {
    const subtitle = input.kind === "praise" ? COPY.writeYourPraise
      : input.kind === "rewrite" ? COPY.writeAClearerVersion : COPY.writeANote;
    return [{ value: "answer", label: COPY.pillAnswer, subtitle, tone: 0 }, nothing];
  }
  const rows: Row[] = [];
  const served = input.served;
  if (served) {
    rows.push({ value: "keep", label: COPY.keepIt, subtitle: COPY.served(served.title), tone: 0, onDetails: () => input.onDetails(served.id) });
  }
  if (input.others > 0) {
    rows.push({ value: "swap", label: COPY.swapIt, subtitle: COPY.moreInLibrary(input.others, input.errorLabel), tone: 1 });
  }
  rows.push({ value: "new", label: COPY.makeANewOne, subtitle: COPY.yourOwnWordsAndVideo, tone: 2 }, nothing);
  return rows;
}

export function DecideScreen({ nav, onClose, asError, rows, loading, busy, fail, onPick }: Frame & {
  asError: boolean;
  rows: readonly Row[];
  loading: boolean;
  busy: boolean;
  fail: string | null;
  onPick: (value: string) => void;
}) {
  const title = asError ? COPY.chooseExercise : COPY.whatWillYouDo;
  return (
    <WalkOverlay nav={nav} title={title} onClose={onClose} testId="coach-panel-decide"
      footer={fail ? <WalkFooter><Fail text={fail} /></WalkFooter> : null}>
      {loading ? <WalkLoading /> : <Rows rows={rows} label={title} onPick={(v) => { if (!busy) onPick(v); }} />}
    </WalkOverlay>
  );
}

/* ── Swap it ──────────────────────────────────────────────────────── */

export function SwapScreen({ nav, onClose, errorLabel, items, picked, busy, fail, onPick, onDetails, onUse, onNew }: Frame & {
  errorLabel: string;
  items: readonly { id: string; title: string; served: boolean }[];
  picked: string | null;
  busy: boolean;
  fail: string | null;
  onPick: (id: string) => void;
  onDetails: (id: string) => void;
  onUse: () => void;
  onNew: () => void;
}) {
  const rows: Row[] = items.map((x, i) => ({
    value: x.id, label: x.title, tone: i, selected: picked === x.id, onDetails: () => onDetails(x.id),
    subtitle: [x.served ? COPY.servedNow : null, COPY.treats(errorLabel)].filter(Boolean).join(" · "),
  }));
  return (
    <WalkOverlay nav={nav} title={COPY.swapIt} subtitle={`${COPY.allTreat(errorLabel)} · ${COPY.shownInRandomOrder}`}
      onClose={onClose} testId="coach-panel-swap"
      footer={<WalkFooter pill={{ label: COPY.useThisOne, onClick: onUse, disabled: busy || !picked, testId: "coach-panel-swap-use" }}
        links={[{ label: COPY.makeANewOne, onClick: onNew, disabled: busy }]}><Fail text={fail} /></WalkFooter>}>
      <Rows rows={rows} label={COPY.swapIt} onPick={onPick} />
    </WalkOverlay>
  );
}

/* ── An exercise's details ────────────────────────────────────────── */

export function DetailScreen({ nav, onClose, title, errorLabel, videoUrl, instruction, busy, fail, onUse, onBackToList }: Frame & {
  title: string;
  errorLabel: string;
  videoUrl: string | null;
  instruction: string;
  busy: boolean;
  fail: string | null;
  onUse: () => void;
  onBackToList: () => void;
}) {
  return (
    <WalkOverlay nav={nav} title={title} subtitle={COPY.treats(errorLabel)} onClose={onClose} testId="coach-panel-exdetail"
      footer={<WalkFooter pill={{ label: COPY.useThisOne, onClick: onUse, disabled: busy, testId: "coach-panel-detail-use" }}
        links={[{ label: COPY.backToTheList, onClick: onBackToList }]}><Fail text={fail} /></WalkFooter>}>
      {videoUrl ? <CoachVideo src={videoUrl} className="aspect-[4/5] w-full" /> : null}
      <CoachMessage><span>{instruction}</span></CoachMessage>
    </WalkOverlay>
  );
}

/* ── Your words ───────────────────────────────────────────────────── */

export function WordsScreen({ nav, onClose, title, pseudonym, player, clearer, text, editing, drafting, onChange, onToggle, onNext }: Frame & {
  title: string;
  pseudonym: string;
  /** The speaker's passage on its player. */
  player: ReactNode;
  /** A clearer version: the words sit in the speaker's rewrite card. */
  clearer: boolean;
  text: string;
  editing: boolean;
  drafting: boolean;
  onChange: (text: string) => void;
  onToggle: () => void;
  onNext: () => void;
}) {
  return (
    <WalkOverlay nav={nav} title={title} subtitle={`${COPY.asWillSeeIt(pseudonym)} · ${COPY.pencilEditsEveryWord}`}
      onClose={onClose} testId="coach-panel-words"
      footer={<WalkFooter pill={{ label: COPY.next, onClick: onNext, disabled: editing || drafting || !text.trim(), testId: "coach-panel-words-next" }} />}>
      {player}
      {drafting ? <WalkLoading /> : (
        <CoachWords text={text} editing={editing} onChange={onChange} onToggle={onToggle}>
          {clearer ? <ClearerWords text={text} /> : undefined}
        </CoachWords>
      )}
    </WalkOverlay>
  );
}

/* ── Your video ───────────────────────────────────────────────────── */

/** The video step's footer: Record, Stop, or Keep and Record again. */
export function videoFooter(input: {
  recorder: CoachVideoRecorder;
  kept: boolean;
  skip: WalkAction | null;
  keep: WalkAction;
  onRecordAgain: () => void;
}): { pill: WalkAction; dot: boolean; links: WalkAction[] } {
  const status = input.recorder.state.status;
  if (status === "recording") return { pill: { label: COPY.stop, onClick: () => void input.recorder.stop() }, dot: false, links: [] };
  if (status === "stopped" || input.kept) {
    return { pill: input.keep, dot: false, links: [{ label: COPY.recordAgain, onClick: input.onRecordAgain }] };
  }
  return {
    pill: { label: COPY.record, onClick: () => void input.recorder.start(), testId: "coach-panel-record" },
    dot: true,
    links: input.skip ? [input.skip] : [],
  };
}

export function VideoScreen({ nav, onClose, isError, recorder, keptUrl, busy, onKeep, onSkip, onRecordAgain }: Frame & {
  isError: boolean;
  recorder: CoachVideoRecorder;
  /** The clip kept earlier for this moment, when the recorder is idle. */
  keptUrl: string | null;
  busy: boolean;
  onKeep: () => void;
  onSkip: () => void;
  onRecordAgain: () => void;
}) {
  const idle = recorder.state.status === "idle" || recorder.state.status === "error";
  const kept = idle && keptUrl !== null;
  const foot = videoFooter({
    recorder, kept,
    keep: { label: COPY.keep, onClick: onKeep, disabled: busy, testId: "coach-panel-video-keep" },
    skip: { label: isError ? COPY.skipTheVideo : COPY.skip, onClick: onSkip, testId: "coach-panel-video-skip" },
    onRecordAgain,
  });
  return (
    <WalkOverlay nav={nav} title={COPY.videoTitle}
      subtitle={`${isError ? COPY.sayTheInstruction : COPY.optional} · ${COPY.underAMinute}`}
      onClose={onClose} testId="coach-panel-video" footer={<WalkFooter pill={foot.pill} dot={foot.dot} links={foot.links} />}>
      {kept ? <CoachVideo src={keptUrl} className="aspect-[4/5] w-full" /> : <CoachVideoBox recorder={recorder} tall />}
    </WalkOverlay>
  );
}

/* ── the kind question ────────────────────────────────────────────── */

export function KindScreen({ nav, onClose, title, options, picked, onPick, onNext, onSkip }: Frame & {
  title: string;
  options: readonly { key: string; label: string }[];
  picked: string | null;
  onPick: (key: string) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <WalkOverlay nav={nav} title={title} onClose={onClose} testId="coach-panel-kind"
      footer={<WalkFooter pill={{ label: COPY.next, onClick: onNext, disabled: !picked, testId: "coach-panel-kind-next" }}
        links={[{ label: COPY.skip, onClick: onSkip }]} />}>
      <WalkChoices label={title} onPick={onPick}
        choices={options.map((o) => ({ value: o.key, label: o.label, selected: picked === o.key, mark: "none" as const }))} />
    </WalkOverlay>
  );
}

/* ── Ready for {p} ────────────────────────────────────────────────── */

export function ShareScreen({ nav, onClose, pseudonym, player, clearer, text, videoUrl, note, withLibrary, busy, fail, onShare, onShareWithoutLibrary }: Frame & {
  pseudonym: string;
  player: ReactNode;
  clearer: boolean;
  text: string;
  videoUrl: string | null;
  /** The one line under the message, when there is one. */
  note: string | null;
  /** The pill files it in the library too; the link shares without it. */
  withLibrary: boolean;
  busy: boolean;
  fail: string | null;
  onShare: () => void;
  onShareWithoutLibrary: () => void;
}) {
  return (
    <WalkOverlay nav={nav} title={COPY.readyFor(pseudonym)} onClose={onClose} testId="coach-panel-share"
      footer={<WalkFooter pill={{ label: COPY.shareWith(pseudonym), onClick: onShare, disabled: busy, testId: "coach-panel-share-pill" }}
        links={withLibrary ? [{ label: COPY.shareWithoutLibrary, onClick: onShareWithoutLibrary, disabled: busy, testId: "coach-panel-share-only" }] : []}>
        <Fail text={fail} />
      </WalkFooter>}>
      {player}
      <CoachMessage>
        {clearer ? <span className="text-[18px] font-semibold leading-[1.45] text-primary">{text}</span> : <span>{text}</span>}
        {videoUrl ? <CoachVideo src={videoUrl} className="aspect-video w-full" /> : null}
      </CoachMessage>
      {note ? <p data-testid="coach-panel-share-note" className="m-0 text-[14.5px] text-muted-foreground">{note}</p> : null}
    </WalkOverlay>
  );
}

/* ── Summary ──────────────────────────────────────────────────────── */

export function SummaryScreen({ nav, onClose, children, ready, onNext, onChange }: Frame & {
  /** The slide, the passage on its player and the facts. */
  children: ReactNode;
  ready: boolean;
  onNext: () => void;
  onChange: () => void;
}) {
  return (
    <WalkOverlay nav={nav} title={COPY.summary} onClose={onClose} testId="coach-panel-summary"
      footer={ready ? <WalkFooter pill={{ label: COPY.next, onClick: onNext, testId: "coach-panel-summary-next" }}
        links={[{ label: COPY.changeMyAnswer, onClick: onChange, testId: "coach-panel-change-answer" }]} /> : null}>
      {children}
    </WalkOverlay>
  );
}

/* ── A word for this Take ─────────────────────────────────────────── */

type TakeFrame = { where: string; onBack: () => void; onClose: () => void; pseudonym: string };

export function TakeWordScreen({ where, onBack, onClose, pseudonym, text, editing, loading, onChange, onToggle, onNext, onSkip }: TakeFrame & {
  text: string;
  editing: boolean;
  loading: boolean;
  onChange: (text: string) => void;
  onToggle: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <WalkOverlay onBack={onBack} backLabel={where} title={COPY.takeWordTitle}
      subtitle={`${COPY.optional} · ${COPY.opensFirstIn(pseudonym)}`} onClose={onClose} testId="coach-panel-takeword"
      footer={<WalkFooter pill={{ label: COPY.next, onClick: onNext, disabled: editing || loading || !text.trim(), testId: "coach-panel-takeword-next" }}
        links={[{ label: COPY.skip, onClick: onSkip, testId: "coach-panel-takeword-skip" }]} />}>
      {loading ? <WalkLoading /> : <CoachWords text={text} editing={editing} onChange={onChange} onToggle={onToggle} />}
    </WalkOverlay>
  );
}

export function TakeVideoScreen({ where, onBack, onClose, pseudonym, recorder, words, busy, fail, onSend, onRecordAgain }: TakeFrame & {
  recorder: CoachVideoRecorder;
  /** The word, with its pencil. */
  words: ReactNode;
  busy: boolean;
  fail: string | null;
  onSend: () => void;
  onRecordAgain: () => void;
}) {
  const status = recorder.state.status;
  const foot = videoFooter({
    recorder, kept: false,
    keep: { label: COPY.sendTo(pseudonym), onClick: onSend, disabled: busy, testId: "coach-panel-takevideo-send" },
    skip: { label: COPY.sendWithoutAVideo, onClick: onSend, disabled: busy, testId: "coach-panel-takevideo-send-without" },
    onRecordAgain,
  });
  return (
    <WalkOverlay onBack={onBack} backLabel={where} title={COPY.videoTitle} subtitle={COPY.asWillSeeIt(pseudonym)}
      onClose={onClose} testId="coach-panel-takevideo"
      footer={<WalkFooter pill={foot.pill} dot={foot.dot} links={foot.links}><Fail text={fail} /></WalkFooter>}>
      <CoachVideoBox recorder={recorder} />
      {status === "recording" ? null : words}
    </WalkOverlay>
  );
}
