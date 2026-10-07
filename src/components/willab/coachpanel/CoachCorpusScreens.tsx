"use client";

/* -------------------------------------------------------------------------- */
/*  The training corpus inside the panel (founder lock 2026-10-06, CO1 A;      */
/*  build plan D-CP-20), drawn to the prototype's screens:                     */
/*                                                                            */
/*    CorpusHomeScreen     Training corpus: the imports, each with whose      */
/*                         voice it is and how many moments wait, or its      */
/*                         set-up not finished; the pill "Import audio"       */
/*    CorpusImportScreen   Import audio (or Finish the set-up): the file, the */
/*                         corpus page's own fields and words, what to run;   */
/*                         Import is off until file, topic and language are   */
/*                         set (Set up needs topic and language)              */
/*    CorpusAnalyseScreen  the app's one loader, "Analysing on the server…"   */
/*                                                                            */
/*  The judging screen is the panel's own JudgeScreen (CoachPanelScreens),    */
/*  driven by CoachCorpusJudge. Presentational: the host owns the state, the  */
/*  fetches and the writes. Every word is COACH_PANEL_COPY's; the only        */
/*  numbers are counts of moments (AC-9). Hide, delete and restore are not    */
/*  here: they moved to the founder's admin area (Q-B15 A).                   */
/* -------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import WalkOverlay from "../walk/WalkOverlay";
import WalkChoices, { type WalkChoice } from "../walk/WalkChoices";
import WalkFooter from "../walk/WalkFooter";
import WalkLoading from "../walk/WalkLoading";
import { IMPORT_LANGUAGES, OPTIONAL_STAGES, type OptionalStage, type TrainingImport } from "@/services/api/trainingCorpus";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";

/* ── the imports ─────────────────────────────────────────────────────── */

/** How many of an import's moments still wait, when the list says. */
export function momentsLeft(im: Pick<TrainingImport, "queueCount" | "labelledCount">): { left: number; total: number } | null {
  if (im.queueCount === null) return null;
  return { left: Math.max(0, im.queueCount - (im.labelledCount ?? 0)), total: im.queueCount };
}

/** One import as a choice: its set-up not finished (opens the set-up), its
 *  moments to judge, or all labelled. Pure. */
export function importChoice(im: TrainingImport): WalkChoice {
  const value = im.sessionId;
  if (!im.setupComplete) {
    return { value, label: im.topic, subtitle: `${COPY.setUpNotFinished} · ${COPY.finishItBeforeJudging}` };
  }
  const who = im.speakerLabel ?? COPY.noSpeakerLabel;
  if (im.state === "running") return { value, label: im.topic, subtitle: `${who} · ${COPY.analysing}`, done: true, dim: true };
  const counts = momentsLeft(im);
  if (!counts || counts.total === 0) return { value, label: im.topic, subtitle: `${who} · ${COPY.moments(counts?.total ?? 0)}`, done: true };
  if (counts.left === 0) return { value, label: im.topic, subtitle: `${who} · ${COPY.allLabelled(counts.total)}`, done: true, mark: "check" };
  return { value, label: im.topic, subtitle: `${who} · ${COPY.momentsToJudgeOf(counts.left, counts.total)}` };
}

export function CorpusHomeScreen({ imports, loading, fail, onImport, onOpen, onClose }: {
  /** null while it loads or when it could not be read. */
  imports: readonly TrainingImport[] | null;
  loading: boolean;
  /** The backend's own sentence when the last import or set-up was refused. */
  fail: string | null;
  onImport: () => void;
  onOpen: (im: TrainingImport) => void;
  onClose: () => void;
}) {
  const footer = (
    <WalkFooter pill={{ label: COPY.importAudio, onClick: onImport, testId: "corpus-import-button" }}>
      {fail ? <p role="alert" className="m-0 pb-2 text-center text-[14px] text-destructive">{fail}</p> : null}
    </WalkFooter>
  );
  return (
    <WalkOverlay title={COPY.trainingCorpus} caption={COPY.corpusCaption} onClose={onClose} footer={footer} testId="coach-panel-corpushome">
      {imports && imports.length > 0 ? (
        <WalkChoices
          label={COPY.trainingCorpus}
          choices={imports.map(importChoice)}
          onPick={(v) => {
            const im = imports.find((i) => i.sessionId === v);
            if (im) onOpen(im);
          }}
        />
      ) : loading ? (
        <WalkLoading />
      ) : (
        <p data-testid="corpus-empty" className="m-0 text-[14.5px] text-muted-foreground">{`${COPY.oneRecording} · ${COPY.cutIntoMoments}`}</p>
      )}
    </WalkOverlay>
  );
}

/* ── the set-up ──────────────────────────────────────────────────────── */

export interface ImportForm {
  file: File | null;
  topic: string;
  speaker: string;
  /** ISO-639-1, "" for auto-detect, null while not chosen. */
  language: string | null;
  source: string;
  stages: OptionalStage[];
}

export const BLANK_IMPORT: ImportForm = { file: null, topic: "", speaker: "", language: null, source: "", stages: [] };

/** Import needs a file, a topic and a language; a set-up (an import that
 *  exists) needs the topic and the language. Pure. */
export function importReady(form: ImportForm, setupOf: string | null): boolean {
  if (!form.topic.trim() || form.language === null) return false;
  return setupOf !== null || form.file !== null;
}

const FIELD = "w-full rounded-[14px] border-[1.5px] border-border bg-background p-3.5 text-[17px] text-foreground outline-none focus:border-foreground";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[14px] text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="text-[12.5px] leading-[1.45] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function RunRow({ label, hint, checked, locked, onChange }: {
  label: string; hint: string; checked: boolean; locked?: boolean; onChange?: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[15px]">
      <input type="checkbox" checked={checked} disabled={locked} onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 h-4 w-4 accent-foreground" />
      <span>
        <b className="block font-semibold">{label}</b>
        <small className="block text-[12.5px] text-muted-foreground">{hint}</small>
      </span>
    </label>
  );
}

export function CorpusImportScreen({ setupOf, form, busy, fail, onChange, onPickFile, onSubmit, onBack, onClose }: {
  /** The import whose set-up is being finished, or null for a new file. */
  setupOf: string | null;
  form: ImportForm;
  busy: boolean;
  fail: string | null;
  onChange: (next: ImportForm) => void;
  onPickFile: () => void;
  onSubmit: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const ready = importReady(form, setupOf) && !busy;
  const footer = (
    <WalkFooter pill={{ label: setupOf ? COPY.setUp : COPY.importPill, onClick: onSubmit, disabled: !ready, testId: "corpus-submit" }}>
      {fail ? <p role="alert" className="m-0 pb-2 text-center text-[14px] text-destructive">{fail}</p> : null}
    </WalkFooter>
  );
  const stage = (s: OptionalStage) => form.stages.includes(s);
  const setStage = (s: OptionalStage, on: boolean) =>
    onChange({ ...form, stages: on ? [...form.stages.filter((x) => x !== s), s] : form.stages.filter((x) => x !== s) });
  return (
    <WalkOverlay
      title={setupOf ? COPY.finishTheSetUp : COPY.importAudio}
      caption={setupOf ? COPY.beforeItsMomentsCanBeJudged : null}
      onBack={onBack} onClose={onClose} footer={footer} testId="coach-panel-corpusimport"
    >
      {setupOf ? null : (
        <WalkChoices
          label={COPY.chooseAFile}
          choices={[form.file
            ? { value: "file", label: form.file.name, selected: true, mark: "check", testId: "corpus-file" }
            : { value: "file", label: COPY.chooseAFile, subtitle: COPY.audioOrVideo, testId: "corpus-file" }]}
          onPick={onPickFile}
        />
      )}
      <Field label={COPY.whatTheTalkIsAbout}>
        <input data-testid="corpus-topic" className={FIELD} placeholder={COPY.topicPlaceholder} value={form.topic}
          onChange={(e) => onChange({ ...form, topic: e.target.value })} />
      </Field>
      <Field label={COPY.whoseVoiceThisIs} hint={COPY.speakerHint}>
        <input data-testid="corpus-speaker" className={FIELD} placeholder={COPY.speakerPlaceholder} value={form.speaker}
          onChange={(e) => onChange({ ...form, speaker: e.target.value })} />
      </Field>
      <Field label={COPY.whatLanguageItIsIn} hint={COPY.languageHint}>
        <select data-testid="corpus-language" className={FIELD} value={form.language ?? "none"}
          onChange={(e) => onChange({ ...form, language: e.target.value === "none" ? null : e.target.value })}>
          <option value="none" disabled>{COPY.chooseLanguage}</option>
          {IMPORT_LANGUAGES.map((l) => <option key={l.code || "auto"} value={l.code}>{l.label}</option>)}
        </select>
      </Field>
      <Field label={COPY.whereItCameFrom}>
        <input data-testid="corpus-source" className={FIELD} placeholder={COPY.sourcePlaceholder} value={form.source}
          onChange={(e) => onChange({ ...form, source: e.target.value })} />
      </Field>
      {setupOf ? null : (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{COPY.whatToRun}</span>
          <div className="flex flex-col gap-2.5 rounded-2xl border-[1.5px] border-border px-3.5 py-2.5">
            <RunRow label={COPY.runConfidence} hint={COPY.runConfidenceHint} checked locked />
            <RunRow label={COPY.runAnalytics} hint={COPY.runAnalyticsHint} checked={stage(OPTIONAL_STAGES[0])} onChange={(on) => setStage(OPTIONAL_STAGES[0], on)} />
            <RunRow label={COPY.runIdealText} hint={COPY.runIdealTextHint} checked={stage(OPTIONAL_STAGES[1])} onChange={(on) => setStage(OPTIONAL_STAGES[1], on)} />
          </div>
        </div>
      )}
    </WalkOverlay>
  );
}

/* ── the loader ──────────────────────────────────────────────────────── */

export function CorpusAnalyseScreen({ onClose }: { onClose: () => void }) {
  return (
    <WalkOverlay onClose={onClose} testId="coach-panel-corpusanalyse">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3.5 text-center">
        <WalkLoading />
        <p className="m-0 text-[15.5px] text-muted-foreground">{COPY.analysing}</p>
      </div>
    </WalkOverlay>
  );
}
