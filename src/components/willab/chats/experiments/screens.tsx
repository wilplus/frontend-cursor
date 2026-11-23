"use client";

import { useState } from "react";
import { useComposerVoice } from "../useComposerVoice";
import { AUDIO_MAX_SECONDS } from "@/lib/willab/chatBuilder/voiceMeasures";
import { pickInterventions } from "@/lib/willab/experiments/overlap";
import { readingFor } from "@/lib/willab/experiments/sample";
import {
  deletePrompt,
  EXPERIMENTS_USE_MOCKS,
  downloadExport,
  EXPERIMENTS_USE_MOCKS,
  exportMine,
  openSession,
  readInterventions,
  readTakes,
  saveIntervention,
  savePrompt,
} from "@/services/api/experiments";
import type { AnalyzeStep, AnalyzeTake, Intervention, Prompt, PromptFile, StepSummary } from "@/lib/willab/experiments/types";
import { axisTitle, axisWords, comparisonWords, cueWords, formatCue, gateSentence, isOpeningPrompt, optionLabel, referenceLine, reportLabel, tagWords } from "@/lib/willab/experiments/words";
import { ActionPair, Bubble, choiceBubble, ChoicePair, Frame, Note } from "./bits";

export type Rating = { energy?: string; feeling?: string };

export type View =
  | { name: "menu"; page: number }
  | { name: "consent" }
  | { name: "upload" }
  | { name: "prompt"; sessionId: string; index: number; said: boolean; rating: Rating; audio?: Blob; takeId?: string }
  | { name: "reading"; sessionId: string; index: number; takeId: string; rating: Rating }
  | { name: "analysis"; sessionId: string; index: number; takeId: string; moment: number; source: "saved" | "open" | "gate"; rating: Rating }
  | { name: "pick"; sessionId: string | null; index: number; takeId: string; moment: number; source: "saved" | "open" | "gate"; rules: boolean; slot: number; cell: number }
  | { name: "library"; index: number; editing: boolean; adding: boolean }
  | { name: "preview-complete" }
  | { name: "export" }
  | { name: "delete"; step: "ask" | "sure" | "gone" };

const MENU = [
  [
    EXPERIMENTS_USE_MOCKS
      ? { id: "session", title: "Preview five questions", line: "See the order and try sample feedback." }
      : { id: "session", title: "Start a session", line: "Try the speaking questions in order." },
    { id: "library", title: "Prompt library", line: "See and edit the speaking questions." },
  ],
  [
    { id: "sample", title: "See a sample reading", line: "See what the app hears in an example." },
    { id: "rules", title: "Practice rules", line: "See how the app picks an exercise." },
  ],
  [
    { id: "export", title: "Export my data", line: "A file of your sessions." },
    { id: "delete", title: "Delete my data", line: "Remove your sessions." },
  ],
] as const;

export function Menu({ page, onPage, onOpen }: { page: number; onPage: (page: number) => void; onOpen: (id: string) => void }) {
  const items = MENU[page] ?? MENU[0];
  return (
    <Frame
      screen="menu"
      kicker={`${page + 1} of ${MENU.length}`}
      title="Experiments"
      foot={
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            {items.map((item) => (
              <button key={item.id} type="button" data-exp-go={item.id} onClick={() => onOpen(item.id)} className={`${choiceBubble(false)} rounded-2xl text-left`}>
                <span className="block">{item.title}</span>
                <span className="block text-[14px] font-normal text-foreground">{item.line}</span>
              </button>
            ))}
          </div>
          <ActionPair name="pages" no="Previous page" yes="Next page" onNo={() => onPage(Math.max(0, page - 1))} onYes={() => onPage(Math.min(MENU.length - 1, page + 1))} />
        </div>
      }
    >
      <Note>Try a speaking session or look at an example of how the app suggests practice.</Note>
    </Frame>
  );
}

export function Consent({ onNo, onYes }: { onNo: () => void; onYes: () => void }) {
  if (EXPERIMENTS_USE_MOCKS) {
    return (
      <Frame
        screen="consent"
        help="preview-start"
        title="Preview the five questions"
        foot={<ActionPair name="consent" no="Back" yes="Open preview" onNo={onNo} onYes={onYes} />}
      >
        <Note>Start with three calm questions. Then try one positive question and one challenging question.</Note>
        <Note>This walkthrough uses sample readings. Invited participants record after they choose to take part in the shared test chat.</Note>
      </Frame>
    );
  }
  return (
    <Frame screen="consent" title="Before you start" foot={<ActionPair name="consent" no="Not now" yes="I agree" onNo={onNo} onYes={onYes} />}>
      <Bubble data-ai-disclosure="">An AI reads this session. It looks at how you speak. It does not name a feeling.</Bubble>
      <Note>Only you can see the result. No employer, and no one else.</Note>
      <Note>{EXPERIMENTS_USE_MOCKS ? "This sample stays on this device." : "Your recording and any page you attach are kept with your private session."}</Note>
    </Frame>
  );
}

export function Upload({ onStart }: { onStart: (page?: File) => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const start = async (file?: File) => {
    if (busy) return false;
    setBusy(true);
    setError(false);
    try {
      const started = await onStart(file);
      if (!started) setError(true);
      return started;
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame screen="upload" title="Add one page?"
      composer={{
        files: [{ label: "Add a page", accept: ".pdf,.png,.jpg,.jpeg,.ppt,.pptx,.txt", sendFile: start }],
        busy,
        status: error ? <p role="alert" className="px-2 text-sm text-destructive">Could not start the session. Try again.</p> : null,
      }}
      foot={
        <div data-pair="page" className="flex justify-end">
          <button type="button" data-choice="no" disabled={busy} onClick={() => void start()} className={choiceBubble(false)}>Skip</button>
        </div>
      }
    >
      <Note>A slide or a one-page case. You can skip.</Note>
    </Frame>
  );
}

export function PromptStep({ file, view, saving, saveError, onSkip, onSaid, onRate, onAgain, onSave }: {
  file: PromptFile;
  view: Extract<View, { name: "prompt" }>;
  saving: boolean;
  saveError: string | null;
  onSkip: () => void;
  onSaid: (audio?: Blob) => void;
  onRate: (rating: Rating) => void;
  onAgain: () => void;
  onSave: () => void;
}) {
  const sample = EXPERIMENTS_USE_MOCKS;
  const { mic, recording, voiceDraft, error } = useComposerVoice({
    enabled: !sample && !view.said,
    maxSeconds: AUDIO_MAX_SECONDS,
    onSend: (audio) => { onSaid(audio); return true; },
  });
  const prompt = file.prompts[view.index];
  if (!prompt) return null;
  const opening = isOpeningPrompt(prompt, file);
  const ready = Boolean(view.rating.energy && view.rating.feeling);
  const against = referenceLine(prompt.reference);
  return (
    <Frame
      key={prompt.id}
      screen={opening ? "baseline" : "take"}
      help={sample ? (view.said ? "preview-rating" : "preview-question") : view.said ? "rating" : undefined}
      kicker={`${sample ? "Preview · " : ""}${view.index + 1} of ${file.prompts.length}`}
      title={opening ? "Your usual way" : "A take"}
      composer={sample || view.said ? undefined : {
        voiceRequired: true, mic, recording, voiceDraft,
        status: error ? <p role="alert" className="px-2 text-sm text-destructive">{error}</p> : null,
      }}
      foot={view.said
        ? <ActionPair name="save" no={sample ? "Choose again" : "Say it again"}
            yes={saving ? "Saving…" : sample ? "Continue" : "Save this take"} onNo={onAgain} onYes={onSave} disabled={saving} />
        : sample ? <ActionPair name="said" no="Skip this one" yes="Use sample answer" onNo={onSkip} onYes={() => onSaid()} />
        : recording ? null : (
          <div data-pair="said" className="flex flex-wrap justify-end gap-2">
            <button type="button" data-choice="no" className={choiceBubble(false)} onClick={onSkip}>Skip this one</button>
          </div>
        )}
    >
      {!opening ? <p className="m-0 text-[13px] font-medium text-muted-foreground">{tagWords(prompt.tag)}</p> : null}
      <Bubble data-prompt-text="" data-prompt-id={prompt.id} lang={file.language}>{prompt.text}</Bubble>
      {against ? <Note>{against}</Note> : null}
      {view.said
        ? <RatingFields file={file} rating={view.rating} onRate={onRate} ready={ready} />
        : <Note>{sample ? "Use a sample answer to see the rating step. Recording happens in the shared test chat." : "A recording will be kept with your private session."}</Note>}
      {saveError ? <p role="alert" className="text-sm text-destructive">{saveError}</p> : null}
    </Frame>
  );
}

function RatingFields({ file, rating, onRate, ready }: { file: PromptFile; rating: Rating; onRate: (rating: Rating) => void; ready: boolean }) {
  const fields = ["energy", "feeling"] as const;
  return (
    <div data-rating="" className="flex flex-col gap-2">
      <p className="m-0 text-[16px] font-medium">{EXPERIMENTS_USE_MOCKS ? "Choose ratings for the sample answer" : "How was that take?"}</p>
      {fields.map((key) => (
        <div key={key} className="flex flex-col gap-1">
          <span className="text-[13px] text-muted-foreground">{reportLabel(key)}</span>
          <ChoicePair
            name={key}
            value={rating[key]}
            options={file.self_report[key].map((value) => ({ value, label: optionLabel(value) }))}
            onPick={(value) => onRate({ ...rating, [key]: value })}
          />
        </div>
      ))}
      {ready ? null : <Note>Tap both, then save.</Note>}
    </div>
  );
}

export function Reading() {
  if (EXPERIMENTS_USE_MOCKS) {
    return <Frame screen="reading" help="preview-reading" title="Loading sample feedback"><Note>This reading uses an example.</Note></Frame>;
  }
  return (
    <Frame screen="reading" title="Reading your take...">
      <Bubble data-ai-disclosure="">An AI is reading how you spoke. Only you will see it.</Bubble>
      <p data-research-note="" className="m-0 text-[14px] text-muted-foreground">This is an early research version.</p>
    </Frame>
  );
}

function loadTake(source: "saved" | "open" | "gate", takeId: string): AnalyzeTake | null {
  if (source === "open") return readingFor("open");
  if (source === "gate") return readingFor("gate");
  return readTakes().find((take) => take.id === takeId)?.analysis ?? null;
}

export function Analysis({ view, onMoment, onTry, onNext }: {
  view: Extract<View, { name: "analysis" }>;
  onMoment: (moment: number) => void;
  onTry: () => void;
  onNext: () => void;
}) {
  const analysis = loadTake(view.source, view.takeId);
  const moment = analysis?.moments[view.moment];
  if (!analysis || !moment) return <Frame screen="analysis" help="no-reading" title="No reading yet"><Note>Save a take first.</Note></Frame>;
  const order = analysis.order;
  const sample = EXPERIMENTS_USE_MOCKS || view.source !== "saved";
  return (
    <Frame
      screen="analysis"
      kicker={sample ? "Example" : "This take"}
      title={sample ? "Sample feedback" : "The reading"}
      foot={<ActionPair name="next" no={view.source === "saved" ? "Next prompt" : "Done"} yes="What to try" onNo={onNext} onYes={onTry} />}
    >
      <Bubble data-ai-disclosure="">{sample ? "This is an example of the feedback a participant sees." : "An AI made this reading. Only you can see it."}</Bubble>
      <p data-research-note="" className="m-0 text-[14px] text-muted-foreground">This is an early research version.</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[14px] text-muted-foreground">{moment.t_start} s to {moment.t_end} s · {view.moment + 1} of {analysis.moments.length}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" data-moment="prev" onClick={() => onMoment(Math.max(0, view.moment - 1))} className={choiceBubble(false)}>Earlier</button>
          <button type="button" data-moment="next" onClick={() => onMoment(Math.min(analysis.moments.length - 1, view.moment + 1))} className={choiceBubble(true)}>Later</button>
        </div>
      </div>
      <div data-analysis-grid="" className="flex flex-col gap-2">
        {order.map((step) => (
          <StepRow key={step} step={step} cells={moment.grid.filter((cell) => cell.step === step)} />
        ))}
      </div>
      <div data-summary="" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {order.map((step) => <SummaryCell key={step} step={step} row={analysis.summary[step]} />)}
      </div>
      <p data-gate={analysis.gate?.step ?? ""} className="m-0 text-[14px] leading-snug">{gateSentence(analysis.gate)}</p>
    </Frame>
  );
}

function StepRow({ step, cells }: { step: AnalyzeStep; cells: AnalyzeTake["moments"][number]["grid"] }) {
  return (
    <div data-step={step} className="flex min-w-0 flex-col gap-2 rounded-2xl bg-muted p-3">
      <span className="text-[15px] font-medium leading-snug">{axisTitle(step)}</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cells.map((cell) => (
          <span key={cell.cue} data-cue={cell.cue} data-vs={cell.vs} className="min-w-0 rounded-xl bg-background px-2.5 py-2">
            <small className="block break-words text-[13px] leading-snug text-muted-foreground">{cueWords(cell.cue)}</small>
            <b className="block text-[15px] leading-snug">{cell.value === null ? "not measured" : formatCue(cell.value)}</b>
            <small className="block break-words text-[13px] leading-snug text-muted-foreground">{comparisonWords(cell.vs)}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

function SummaryCell({ step, row }: { step: AnalyzeStep; row: StepSummary }) {
  const locked = !row.unlocked;
  return (
    <div data-summary-step={step} data-locked={locked ? "" : undefined} className="rounded-xl border border-border px-3 py-2">
      <span className="block text-[13px] leading-snug text-muted-foreground">{axisTitle(step)}</span>
      {locked ? <b className="text-[14px]">Locked</b> : (
        <>
          <b className="text-[14px]">{row.score === null ? "not measured" : formatCue(row.score)}</b>
          <span className="block text-[13px] leading-snug text-muted-foreground">{row.confidence >= 0.5 ? "Sure enough" : "Not sure yet"}</span>
        </>
      )}
    </div>
  );
}

export function Pick({ view, onRules, onChoose, onEdit }: {
  view: Extract<View, { name: "pick" }>;
  onRules: (rules: boolean) => void;
  onChoose: (id: string | null) => void;
  onEdit: (slot: number, cell: number) => void;
}) {
  const analysis = loadTake(view.source, view.takeId);
  const moment = analysis?.moments[view.moment];
  const items = readInterventions();
  const pick = analysis && moment ? pickInterventions(moment, items, analysis.order, view.takeId, analysis.gate) : null;
  const shown = pick?.shown ?? [];
  return (
    <Frame
      screen={view.rules ? "rules" : "pick"}
      help={!view.rules && !shown.length ? "pick-empty" : undefined}
      title={view.rules ? "The rules" : "What to try next"}
      foot={!view.rules && <PickFoot shown={shown} onChoose={onChoose} />}
    >
      <div className="sticky top-0 z-10 bg-background py-1">
        <ChoicePair
          name="mode"
          value={view.rules ? "rules" : "pick"}
          options={[{ value: "pick", label: "The pick" }, { value: "rules", label: "The rules" }]}
          onPick={(value) => onRules(value === "rules")}
        />
      </div>
      {view.rules ? <RuleEditor items={items} view={view} onEdit={onEdit} /> : <PickList shown={shown} />}
    </Frame>
  );
}

function PickList({ shown }: { shown: { id: string; name: string; step: string }[] }) {
  if (shown.length === 0) return <Note>No exercise matches this clip closely enough. Open The rules to see what the picker looks for.</Note>;
  return (
    <div className="flex flex-col gap-2">
      <Note>Here’s what the app would suggest practising for this clip.</Note>
      {shown.map((hit) => (
        <Bubble key={hit.id} data-hit={hit.id}>
          <strong>{hit.name}</strong>
          <span className="block text-[14px] text-muted-foreground">For {axisWords(hit.step)}.</span>
        </Bubble>
      ))}
    </div>
  );
}

function PickFoot({ shown, onChoose }: { shown: { id: string; name: string }[]; onChoose: (id: string | null) => void }) {
  if (shown.length >= 2) return <ActionPair name="use" no={shown[1].name} yes={shown[0].name} onNo={() => onChoose(shown[1].id)} onYes={() => onChoose(shown[0].id)} />;
  if (shown.length === 1) return <ActionPair name="use" no="Not this time" yes="Use this" onNo={() => onChoose(null)} onYes={() => onChoose(shown[0].id)} />;
  return <ActionPair name="use" no="Not this time" yes="Keep looking" onNo={() => onChoose(null)} onYes={() => undefined} />;
}

function RuleEditor({ items, view, onEdit }: {
  items: Intervention[];
  view: Extract<View, { name: "pick" }>;
  onEdit: (slot: number, cell: number) => void;
}) {
  const item = items[view.slot] ?? items[0];
  const cell = item?.grid[view.cell];
  if (!item || !cell) return <Note>There’s no practice rule to edit here yet.</Note>;
  const move = (delta: number) => {
    const threshold = Math.max(0, Math.min(2, Math.round((item.threshold + delta) * 10) / 10));
    void saveIntervention({ ...item, threshold });
  };
  const nudge = (by: number) => {
    const grid = item.grid.map((cell, index) => index === view.cell ? { ...cell, value: clamp(cell.value + by) } : cell);
    void saveIntervention({ ...item, grid });
  };
  return (
    <div data-rule-editor="" className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Bubble className="w-full">
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">Exercise name</span>
            <input data-rule-name="" value={item.name} onChange={(event) => void saveIntervention({ ...item, name: event.target.value })} className="h-11 min-w-0 rounded-xl border border-border bg-background px-3" />
          </label>
        </Bubble>
        <ActionPair name="rule-step" no="Previous rule" yes="Next rule" onNo={() => onEdit(Math.max(0, view.slot - 1), 0)} onYes={() => onEdit(Math.min(items.length - 1, view.slot + 1), 0)} />
      </div>
      <div className="flex flex-col gap-2">
        <Bubble>
          <strong>Minimum match · {item.threshold.toFixed(1)}</strong>
          <p className="m-0">A stricter rule needs the clip to match more closely before it suggests this exercise.</p>
        </Bubble>
        <ActionPair name="threshold" no="Looser" yes="Stricter" onNo={() => move(-0.1)} onYes={() => move(0.1)} />
      </div>
      <div className="flex flex-col gap-2">
        <Bubble data-rule-cell="">
          <strong>{cueWords(cell.cue)} · {formatCue(cell.value)}</strong>
          <p className="m-0 text-muted-foreground">{axisTitle(cell.step)}</p>
          <p className="m-0">This is one thing the rule listens for. Lower and Higher change the value it looks for.</p>
        </Bubble>
        <ActionPair name="cell-value" no="Lower" yes="Higher" onNo={() => nudge(-0.2)} onYes={() => nudge(0.2)} />
        <ActionPair name="cell-step" no="Previous cue" yes="Next cue" onNo={() => onEdit(view.slot, Math.max(0, view.cell - 1))} onYes={() => onEdit(view.slot, Math.min(item.grid.length - 1, view.cell + 1))} />
      </div>
    </div>
  );
}

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, Math.round(value * 10) / 10));
}

export function Library({ file, view, onIndex, onEdit }: {
  file: PromptFile;
  view: Extract<View, { name: "library" }>;
  onIndex: (index: number) => void;
  onEdit: (adding: boolean) => void;
}) {
  const prompt = file.prompts[view.index];
  if (view.editing) return <LibraryEdit key={view.adding ? "new" : prompt?.id ?? "new"} file={file} prompt={view.adding ? null : prompt} onDone={() => onIndex(view.index)} />;
  if (!prompt) return null;
  return (
    <Frame
      screen="library"
      kicker={`${view.index + 1} of ${file.prompts.length}`}
      title="Prompt library"
      foot={(
        <div className="flex flex-col gap-2">
          <ActionPair name="edit" no="Add one" yes="Change this" onNo={() => onEdit(true)} onYes={() => onEdit(false)} />
          <ActionPair name="pages" no="Earlier" yes="Later" onNo={() => onIndex(Math.max(0, view.index - 1))} onYes={() => onIndex(Math.min(file.prompts.length - 1, view.index + 1))} />
        </div>
      )}
    >
      <p className="m-0 text-[13px] font-medium text-muted-foreground">{tagWords(prompt.tag)}</p>
      <Bubble data-prompt-text="" data-prompt-id={prompt.id} lang={file.language}>{prompt.text}</Bubble>
    </Frame>
  );
}

function LibraryEdit({ file, prompt, onDone }: { file: PromptFile; prompt: Prompt | undefined | null; onDone: () => void }) {
  const [text, setText] = useState(prompt?.text ?? "");
  const [tag, setTag] = useState(prompt?.tag ?? file.prompts[0]?.tag ?? "");
  const [tagPage, setTagPage] = useState(0);
  const tags = uniqueTags(file);
  const page = tags.slice(tagPage * 2, tagPage * 2 + 2);
  const save = () => {
    const id = prompt?.id ?? `local-${file.prompts.length + 1}`;
    const next: Prompt = { id, tag, text: text.trim() };
    if (prompt?.reference) next.reference = prompt.reference;
    if (next.text) void savePrompt(next).then(() => onDone());
  };
  const drop = () => {
    if (prompt && file.prompts.length > 1) void deletePrompt(prompt.id).then(() => onDone());
    else onDone();
  };
  return (
    <Frame
      screen="library-edit"
      title={prompt ? "Change this line" : "Add a line"}
      foot={(
        <div className="flex flex-col gap-2">
          {page.length === 2 ? (
            <ChoicePair name="tag" value={tag} options={page.map((value) => ({ value, label: tagWords(value) }))} onPick={setTag} />
          ) : null}
          <ActionPair name="tag-page" no="Other kinds" yes="These kinds" onNo={() => setTagPage((n) => (n + 1) % Math.max(1, Math.ceil(tags.length / 2)))} onYes={() => undefined} />
          <ActionPair name="keep" no="Drop" yes="Save" onNo={drop} onYes={save} />
        </div>
      )}
    >
      <textarea data-prompt-draft="" value={text} rows={3} onChange={(event) => setText(event.target.value)} className="w-full resize-none overflow-hidden rounded-xl border border-border bg-background px-3 py-2 text-[16px] leading-snug" />
    </Frame>
  );
}

function uniqueTags(file: PromptFile): string[] {
  const tags: string[] = [];
  for (const prompt of file.prompts) if (!tags.includes(prompt.tag)) tags.push(prompt.tag);
  return tags;
}

export function Export() {
  const [audience, setAudience] = useState<"self" | "researcher">("self");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const allow = async (researcher: boolean) => {
    setAudience(researcher ? "researcher" : "self");
    const session = await openSession({ sessionId: sessionId ?? undefined, researcher });
    if (session) setSessionId(session.id);
  };
  const grab = async (format: "csv" | "json") => {
    const result = await exportMine(format, audience);
    if (!result.ok) {
      setNote("Say yes to a researcher first.");
      return;
    }
    downloadExport(result);
    setNote(audience === "researcher" ? "A researcher may have this copy." : "This copy is only yours.");
  };
  return (
    <Frame screen="export" title="Your data" foot={<ActionPair name="format" no="CSV" yes="JSON" onNo={() => void grab("csv")} onYes={() => void grab("json")} />}>
      <Note>This file has only your sessions. No one else is in it.</Note>
      <ChoicePair
        name="audience"
        value={audience}
        options={[{ value: "self", label: "Only me" }, { value: "researcher", label: "A researcher" }]}
        onPick={(value) => void allow(value === "researcher")}
      />
      {audience === "researcher" ? <p data-researcher-consent="" className="m-0 text-[14px]">You said a researcher may have a copy.</p> : <Note>A researcher gets a copy only if you say yes.</Note>}
      {note ? <p data-export-note="" className="m-0 text-[14px]">{note}</p> : null}
    </Frame>
  );
}

export function PreviewComplete({ onDone }: { onDone: () => void }) {
  return (
    <Frame
      screen="preview-complete"
      title="Preview complete"
      foot={<div className="flex justify-end"><button type="button" className={choiceBubble(true)} onClick={onDone}>Done</button></div>}
    >
      <Note>This was the five-question outline. In the shared test chat, invited participants record their answers and see their own feedback.</Note>
    </Frame>
  );
}

export function Delete({ step, onAsk, onKeep, onGone, onDone }: {
  step: "ask" | "sure" | "gone";
  onAsk: () => void;
  onKeep: () => void;
  onGone: () => void;
  onDone: () => void;
}) {
  if (step === "gone") {
    return (
      <Frame screen="deleted" title="Your data is gone." foot={<ActionPair name="done" no="Done" yes="Done" onNo={onDone} onYes={onDone} />}>
        <Note>Your sessions and the reading are removed.</Note>
      </Frame>
    );
  }
  if (step === "sure") {
    return (
      <Frame screen="delete-confirm" title="Are you sure?" foot={<ActionPair name="sure" no="No, keep it" yes="Yes, delete it" onNo={onKeep} onYes={onGone} />}>
        <Note>You cannot get it back.</Note>
      </Frame>
    );
  }
  return (
    <Frame screen="delete" title="Delete my data" foot={<ActionPair name="delete" no="Keep it" yes="Delete my data" onNo={onKeep} onYes={onAsk} />}>
      <Note>This removes your sessions, recordings, and the reading. You cannot get them back.</Note>
    </Frame>
  );
}
