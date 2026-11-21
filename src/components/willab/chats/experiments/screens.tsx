"use client";

import { useState } from "react";
import { pickInterventions } from "@/lib/willab/experiments/overlap";
import { sampleAnalysis } from "@/lib/willab/experiments/sample";
import {
  deletePrompt,
  downloadExport,
  exportMine,
  openSession,
  readInterventions,
  readTakes,
  saveIntervention,
  savePrompt,
} from "@/services/api/experiments";
import { axisTitle, axisWords, comparisonWords, formatCue, isOpeningPrompt, optionLabel, referenceLine, reportLabel, tagWords } from "@/lib/willab/experiments/words";
import { stepSummary, CONFIDENCE_FLOOR } from "@/lib/willab/experiments/grid";
import type { Channel, MomentAnalysis, Prompt, PromptFile } from "@/lib/willab/experiments/types";
import { ActionPair, ChoicePair, Frame, Note } from "./bits";

export type Rating = { energy?: string; feeling?: string };

export type View =
  | { name: "menu"; page: number }
  | { name: "consent" }
  | { name: "upload"; sessionId: string }
  | { name: "prompt"; sessionId: string; index: number; said: boolean; rating: Rating }
  | { name: "analysis"; sessionId: string; index: number; takeId: string; moment: number; sample: boolean; rating: Rating }
  | { name: "pick"; sessionId: string | null; index: number; takeId: string; moment: number; sample: boolean; rules: boolean; slot: number; cell: number }
  | { name: "library"; index: number; editing: boolean; adding: boolean }
  | { name: "export" }
  | { name: "delete"; step: "ask" | "sure" | "gone" };

const MENU = [
  [
    { id: "session", title: "Start a session", line: "You record. Only you see it." },
    { id: "library", title: "Prompt library", line: "Lines you can say." },
  ],
  [
    { id: "sample", title: "See a sample reading", line: "A filled-in grid." },
    { id: "rules", title: "Interventions", line: "What to try next." },
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
      foot={<ActionPair name="pages" no="Previous page" yes="Next page" onNo={() => onPage(Math.max(0, page - 1))} onYes={() => onPage(Math.min(MENU.length - 1, page + 1))} />}
    >
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <button key={item.id} type="button" data-exp-go={item.id} onClick={() => onOpen(item.id)} className="flex min-h-32 flex-col items-start justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-left">
            <span className="text-[16px] font-medium text-foreground">{item.title}</span>
            <span className="text-[14px] leading-snug text-muted-foreground">{item.line}</span>
          </button>
        ))}
      </div>
    </Frame>
  );
}

export function Consent({ onNo, onYes }: { onNo: () => void; onYes: () => void }) {
  return (
    <Frame screen="consent" title="Before you start" foot={<ActionPair name="consent" no="Not now" yes="I agree" onNo={onNo} onYes={onYes} />}>
      <p data-ai-disclosure="" className="m-0 text-[16px] leading-snug">An AI reads this session. It looks at how you speak. It does not name a feeling.</p>
      <Note>Only you can see the result. No employer, and no one else.</Note>
      <Note>Nothing is sent to a server yet. It stays on this device.</Note>
    </Frame>
  );
}

export function Upload({ onSkip, onUse }: { onSkip: () => void; onUse: (name: string) => void }) {
  const [name, setName] = useState<string | null>(null);
  return (
    <Frame
      screen="upload"
      title="Add one page?"
      foot={name
        ? <ActionPair name="page" no="Leave it out" yes="Use this page" onNo={onSkip} onYes={() => onUse(name)} />
        : <ActionPair name="page" no="Skip" yes="Add a page" onNo={onSkip} onYes={() => document.getElementById("exp-page")?.click()} />}
    >
      <Note>A slide or a one-page case. It stays with this session. You can skip.</Note>
      {name ? <p data-page-name="" className="m-0 truncate text-[16px]">{name}</p> : null}
      <input id="exp-page" data-page-file="" type="file" accept=".pdf,.png,.jpg,.jpeg,.ppt,.pptx,.txt" className="hidden" onChange={(event) => setName(event.target.files?.[0]?.name ?? null)} />
    </Frame>
  );
}

export function PromptStep({ file, view, onSkip, onSaid, onRate, onAgain, onSave }: {
  file: PromptFile;
  view: Extract<View, { name: "prompt" }>;
  onSkip: () => void;
  onSaid: () => void;
  onRate: (rating: Rating) => void;
  onAgain: () => void;
  onSave: () => void;
}) {
  const prompt = file.prompts[view.index];
  if (!prompt) return null;
  const opening = isOpeningPrompt(prompt, file);
  const ready = Boolean(view.rating.energy && view.rating.feeling);
  const against = referenceLine(prompt.reference);
  return (
    <Frame
      screen={opening ? "baseline" : "take"}
      kicker={`${view.index + 1} of ${file.prompts.length}`}
      title={opening ? "Your usual way" : "A take"}
      foot={view.said
        ? <ActionPair name="save" no="Say it again" yes="Save this take" onNo={onAgain} onYes={onSave} />
        : <ActionPair name="said" no="Skip this one" yes="I said it" onNo={onSkip} onYes={onSaid} />}
    >
      <p className="m-0 text-[13px] font-medium text-muted-foreground">{tagWords(prompt.tag)}</p>
      <p data-prompt-text="" data-prompt-id={prompt.id} lang={file.language} className="m-0 text-[20px] font-medium leading-snug">{prompt.text}</p>
      {against ? <Note>{against}</Note> : null}
      {view.said ? <RatingFields file={file} rating={view.rating} onRate={onRate} ready={ready} /> : <Note>A recording will be kept with your private session. This sample does not send audio yet.</Note>}
    </Frame>
  );
}

function RatingFields({ file, rating, onRate, ready }: { file: PromptFile; rating: Rating; onRate: (rating: Rating) => void; ready: boolean }) {
  const fields = ["energy", "feeling"] as const;
  return (
    <div data-rating="" className="flex flex-col gap-2">
      <p className="m-0 text-[16px] font-medium">How was that take?</p>
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

export function Analysis({ file, view, onMoment, onTry, onNext }: {
  file: PromptFile;
  view: Extract<View, { name: "analysis" }>;
  onMoment: (moment: number) => void;
  onTry: () => void;
  onNext: () => void;
}) {
  const analysis = view.takeId === "sample" ? sampleAnalysis("sample", file) : readTakes().find((take) => take.id === view.takeId)?.analysis;
  const moment = analysis?.moments[view.moment];
  if (!analysis || !moment) return <Frame screen="analysis" title="No reading yet"><Note>Save a take first.</Note></Frame>;
  const gate = analysis.summary.gate;
  return (
    <Frame
      screen="analysis"
      kicker={view.sample ? "Sample numbers" : "This take"}
      title="The reading"
      foot={<ActionPair name="next" no={view.sample ? "Done" : "Next prompt"} yes="What to try" onNo={onNext} onYes={onTry} />}
    >
      <p data-ai-disclosure="" className="m-0 text-[14px] leading-snug">An AI made this reading. Only you can see it. These numbers are a sample.</p>
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-[13px] text-muted-foreground">{moment.start} s to {moment.end} s · {view.moment + 1} of {analysis.moments.length}</p>
        <div className="flex gap-2">
          <button type="button" data-moment="prev" onClick={() => onMoment(Math.max(0, view.moment - 1))} className="min-h-11 rounded-full border border-border px-3 text-[14px] font-semibold">Earlier</button>
          <button type="button" data-moment="next" onClick={() => onMoment(Math.min(analysis.moments.length - 1, view.moment + 1))} className="min-h-11 rounded-full border border-border px-3 text-[14px] font-semibold">Later</button>
        </div>
      </div>
      <Grid file={file} moment={moment} />
      <div data-summary="" className="grid grid-cols-4 gap-2">
        {file.order.map((axis) => {
          const row = stepSummary(analysis.summary, axis);
          if (!row) return null;
          return (
            <div key={axis} data-axis={axis} className="rounded-xl border border-border px-2 py-1.5">
              <span className="block text-[12px] leading-tight text-muted-foreground">{axisTitle(axis)}</span>
              <b className="text-[15px]">{formatCue(row.score)}</b>
              <span className="block text-[12px] leading-tight text-muted-foreground">{row.confidence >= CONFIDENCE_FLOOR ? "Clear enough" : "Not clear enough"}</span>
            </div>
          );
        })}
      </div>
      <p data-gate={typeof gate === "string" ? gate : ""} className="m-0 text-[14px] leading-snug">{typeof gate === "string" ? `The first step that is not clear enough is ${axisWords(gate)}.` : "Every step is clear enough."}</p>
    </Frame>
  );
}

function Grid({ file, moment }: { file: PromptFile; moment: MomentAnalysis }) {
  return (
    <div data-analysis-grid="" className="grid grid-cols-[4.5rem_repeat(4,minmax(0,1fr))] gap-1.5">
      <span />
      {file.order.map((axis) => <span key={axis} className="text-[12px] font-medium leading-tight">{axisTitle(axis)}</span>)}
      {(["verbal", "vocal"] as const).map((row) => (
        <Row key={row} order={file.order} row={row} moment={moment} label={row === "verbal" ? "Words" : "Voice"} />
      ))}
    </div>
  );
}

function Row({ order, row, moment, label }: { order: string[]; row: Channel; moment: MomentAnalysis; label: string }) {
  return (
    <>
      <span className="self-center text-[13px] font-medium">{label}</span>
      {order.map((axis) => {
        const cell = moment.grid[axis]?.[row];
        if (!cell) return <span key={axis} />;
        return (
          <span key={axis} data-cell={`${row}:${axis}`} data-comparison={cell.reference} className="rounded-xl border border-border px-2 py-1.5">
            <b className="block text-[15px]">{formatCue(cell.value)}</b>
            <small className="block text-[11px] leading-tight text-muted-foreground">{comparisonWords(cell.reference)}</small>
          </span>
        );
      })}
    </>
  );
}

export function Pick({ file, view, onRules, onChoose, onEdit }: {
  file: PromptFile;
  view: Extract<View, { name: "pick" }>;
  onRules: (rules: boolean) => void;
  onChoose: (id: string | null) => void;
  onEdit: (slot: number, cell: number) => void;
}) {
  const analysis = view.takeId === "sample" ? sampleAnalysis("sample", file) : readTakes().find((take) => take.id === view.takeId)?.analysis;
  const moment = analysis?.moments[view.moment];
  const pick = moment ? pickInterventions(moment, readInterventions(), file.order, view.takeId) : null;
  const shown = pick?.shown ?? [];
  return (
    <Frame
      screen={view.rules ? "rules" : "pick"}
      title={view.rules ? "The rules" : "What to try next"}
      foot={view.rules ? <RulesFoot file={file} view={view} onEdit={onEdit} /> : <PickFoot shown={shown} onChoose={onChoose} />}
    >
      <ChoicePair
        name="mode"
        value={view.rules ? "rules" : "pick"}
        options={[{ value: "pick", label: "The pick" }, { value: "rules", label: "The rules" }]}
        onPick={(value) => onRules(value === "rules")}
      />
      {view.rules ? <RuleEditor file={file} view={view} /> : <PickList shown={shown} />}
    </Frame>
  );
}

function PickList({ shown }: { shown: { id: string; name: string; step: string }[] }) {
  if (shown.length === 0) return <Note>Nothing matches strongly enough. You can loosen the rule.</Note>;
  return (
    <div className="flex flex-col gap-2">
      <Note>At most two. The earlier step wins.</Note>
      {shown.map((hit) => (
        <p key={hit.id} data-hit={hit.id} className="m-0 rounded-2xl border border-border px-3 py-2 text-[16px]">
          {hit.name}
          <span className="mt-0.5 block text-[13px] text-muted-foreground">For {axisWords(hit.step)}.</span>
        </p>
      ))}
    </div>
  );
}

function PickFoot({ shown, onChoose }: { shown: { id: string; name: string }[]; onChoose: (id: string | null) => void }) {
  if (shown.length >= 2) return <ActionPair name="use" no={shown[1].name} yes={shown[0].name} onNo={() => onChoose(shown[1].id)} onYes={() => onChoose(shown[0].id)} />;
  if (shown.length === 1) return <ActionPair name="use" no="Not this time" yes="Use this" onNo={() => onChoose(null)} onYes={() => onChoose(shown[0].id)} />;
  return <ActionPair name="use" no="Not this time" yes="Keep looking" onNo={() => onChoose(null)} onYes={() => undefined} />;
}

function RuleEditor({ file, view }: { file: PromptFile; view: Extract<View, { name: "pick" }> }) {
  const items = readInterventions();
  const item = items[view.slot] ?? items[0];
  const slots = patternSlots(file.order);
  const slot = slots[view.cell] ?? slots[0];
  if (!item || !slot) return null;
  const value = item.grid[slot.axis]?.[slot.row] ?? 0;
  const move = (delta: number) => void saveIntervention({ ...item, threshold: Math.max(0, Math.min(2, Math.round((item.threshold + delta) * 10) / 10)) });
  return (
    <div className="flex flex-col gap-2">
      <input data-rule-name="" value={item.name} onChange={(event) => void saveIntervention({ ...item, name: event.target.value })} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-[16px]" />
      <p className="m-0 text-[14px]">Fire when the match is at least {item.threshold.toFixed(1)}.</p>
      <ActionPair name="threshold" no="Looser" yes="Stricter" onNo={() => move(-0.1)} onYes={() => move(0.1)} />
      <p data-rule-cell="" className="m-0 text-[14px]">{slot.row === "vocal" ? "Voice" : "Words"} · {axisTitle(slot.axis)} · {formatCue(value)}</p>
    </div>
  );
}

function RulesFoot({ file, view, onEdit }: { file: PromptFile; view: Extract<View, { name: "pick" }>; onEdit: (slot: number, cell: number) => void }) {
  const items = readInterventions();
  const item = items[view.slot] ?? items[0];
  const slots = patternSlots(file.order);
  const slot = slots[view.cell] ?? slots[0];
  const nudge = (by: number) => {
    if (!item || !slot) return;
    const side = { ...item.grid[slot.axis], [slot.row]: clamp((item.grid[slot.axis]?.[slot.row] ?? 0) + by) };
    void saveIntervention({ ...item, grid: { ...item.grid, [slot.axis]: side }, rule: { step: slot.axis } });
  };
  return (
    <div className="flex flex-col gap-2">
      <ActionPair name="cell-value" no="Lower" yes="Higher" onNo={() => nudge(-0.2)} onYes={() => nudge(0.2)} />
      <ActionPair name="cell-step" no="Previous cell" yes="Next cell" onNo={() => onEdit(view.slot, Math.max(0, view.cell - 1))} onYes={() => onEdit(view.slot, Math.min(slots.length - 1, view.cell + 1))} />
      <ActionPair name="rule-step" no="Previous rule" yes="Next rule" onNo={() => onEdit(Math.max(0, view.slot - 1), view.cell)} onYes={() => onEdit(Math.min(items.length - 1, view.slot + 1), view.cell)} />
    </div>
  );
}

function patternSlots(order: readonly string[]): { row: Channel; axis: string }[] {
  const slots: { row: Channel; axis: string }[] = [];
  for (const axis of order) {
    slots.push({ row: "verbal", axis });
    slots.push({ row: "vocal", axis });
  }
  return slots;
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
      <p data-prompt-text="" data-prompt-id={prompt.id} lang={file.language} className="m-0 text-[20px] font-medium leading-snug">{prompt.text}</p>
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
