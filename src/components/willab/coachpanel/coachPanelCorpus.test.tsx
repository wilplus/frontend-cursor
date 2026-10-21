// @vitest-environment jsdom
/*
STORY    As a coach, I want the training corpus in the panel to go straight to
         judging after set-up, let me rename finished imports and import
         several files at once, so that corpus work is quick and blind.
OUTCOME
  O1  A saved set-up goes straight to judging that import, saying
      "Set up · {n} moments".
  O2  An import with nothing to judge is never judged: back on the imports.
  O3  A new import lands on the imports, saying "Imported · {n} moments".
  O4  Never-2: the queue the panel's Judge reads carries no words of a piece.
  O5  A finished import's ⋯ → Edit opens its set-up filled in; Save renames
      it and goes back to the imports.
  O6  Only the founder's ⋯ carries Delete; confirming it erases the import.
  O7  Several files in one Import: each its own import, one at a time in name
      order, filed under the topic and its file's name; the moments of all
      of them in the toast, a file that failed named with the backend's
      sentence (founder 2026-10-21).
  O8  Never over the upload limit: more files than the backend takes in an
      hour are refused at the choice, and a refusal for the hour stops the
      batch, naming every file it left.
  O9  The done imports sit at the bottom of the list; judging one import's
      last moment goes straight on to the next with moments waiting, in the
      list's order, and back to the list when none is left (founder
      2026-10-21).
  O10 The list comes in steps (N100): reaching its bottom reads the next
      step, the loader showing until it lands; judging on reads the next
      step when the ones read hold nothing left to judge.
PROVES   O1 -> "a saved set-up goes straight to judging, with its count"
         O2 -> "a set-up with nothing to judge goes back to the imports, never to judging"
         O3 -> "a new import lands on the imports with its count"
         O4 -> "the panel's queue read carries no words of a piece"
         O5 -> "a finished import's ⋯ → Edit opens its set-up filled in; Save renames it and goes back"
         O6 -> "only the founder's ⋯ carries Delete; confirming it erases the import and reads the list again"
         O7 -> "several files import one at a time, each its own import named by its file"
         O8 -> "a choice over the upload limit is refused, and a refusal for the hour stops the batch"
         O9 -> "the done imports sit at the bottom, and judging goes on from one import to the next"
         O10 -> "reaching the bottom of the list reads its next step"
         O10 -> "judging goes on into the next step of the list"
WHY      Coach panel lock 2026-10-06 (training corpus, D-CP-20); several files
         in one Import, and judging one import after another, founder
         2026-10-21.
*/
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchTrainingImports = vi.fn();
const fetchTrainingImportsPage = vi.fn();
const saveImportSetup = vi.fn();
const fetchBlindConfidenceQueue = vi.fn();
const importTrainingAudio = vi.fn();
const eraseTrainingImport = vi.fn();
let signedInEmail: string | null = null;
vi.mock("../useUserEmail", () => ({ useUserEmail: () => signedInEmail }));
vi.mock("@/services/api/trainingCorpus", async (orig) => ({
  ...(await orig<typeof import("@/services/api/trainingCorpus")>()),
  fetchTrainingImports: (...a: unknown[]) => fetchTrainingImports(...a),
  fetchTrainingImportsPage: (...a: unknown[]) => fetchTrainingImportsPage(...a),
  saveImportSetup: (...a: unknown[]) => saveImportSetup(...a),
  fetchBlindConfidenceQueue: (...a: unknown[]) => fetchBlindConfidenceQueue(...a),
  importTrainingAudio: (...a: unknown[]) => importTrainingAudio(...a),
  eraseTrainingImport: (...a: unknown[]) => eraseTrainingImport(...a),
}));
vi.mock("@/services/api/coachPanel", () => ({
  fetchErrorAudit: vi.fn(async () => null),
  fetchBlockPicks: vi.fn(async () => null),
}));
vi.mock("../coachwalk/useConfidenceChainReceipt", () => ({ useConfidenceChainReceipt: () => ({ current: null }) }));
vi.mock("./CoachCorpusJudge", () => ({
  default: ({ importId, onDone }: { importId: string; onDone: () => void }) => (
    <div data-testid="stub-corpus-judge">{importId}<button type="button" data-testid="stub-judged" onClick={onDone} /></div>
  ),
}));
import { blindPiece, type QueuePiece, type TrainingImport } from "@/services/api/trainingCorpus";
import CoachPanel from "./CoachPanel";
import { PANEL_START, panelReducer, type PanelAction, type PanelState } from "@/lib/willab/coachPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const IMPORT = { sessionId: "i1", arcId: null, topic: "Workshop recording", speakerLabel: null, createdAt: null,
  state: "done" as const, queueCount: null, detail: null, language: "en", setupComplete: false, labelledCount: null, archivedAt: null };
const PIECE = (id: string): QueuePiece => ({ reviewActId: id, snippetId: id, transcript: "SECRET WORDS", label: null, reReview: false,
  learningExposures: [], mlc2BlindReview: null });

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  fetchTrainingImports.mockReset().mockResolvedValue([IMPORT]);
  // One step holding the whole list, unless a test steps it.
  fetchTrainingImportsPage.mockReset().mockImplementation(async () => {
    const imports = await fetchTrainingImports();
    return imports && { imports, nextOffset: null };
  });
  watchers.length = 0;
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
    constructor(seen: (entries: { isIntersecting: boolean }[]) => void) { watchers.push(seen); }
    observe() {}
    disconnect() {}
  };
  saveImportSetup.mockReset().mockResolvedValue({ ok: true });
  fetchBlindConfidenceQueue.mockReset();
  importTrainingAudio.mockReset();
  eraseTrainingImport.mockReset().mockResolvedValue({ ok: true });
  signedInEmail = null;
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const CORPUS = [{ type: "open" }, { type: "corpus" }]
  .reduce((s, a) => panelReducer(s, a as PanelAction), PANEL_START);
const judging = () => document.querySelector("[data-testid='stub-corpus-judge']");
const onImports = () => document.querySelector("[data-testid='coach-panel-corpushome']");

/** The unfinished import opened from the imports, its set-up saved. */
async function setUp(queue: QueuePiece[] | null): Promise<void> {
  fetchBlindConfidenceQueue.mockResolvedValue(queue && { sessionId: "i1", queue: queue.map(blindPiece) });
  act(() => root.render(<Host start={CORPUS} />));
  await flush();
  click(document.querySelector("[data-walk-choice='i1']"));
  const screen = document.querySelector("[data-testid='coach-panel-corpusimport']")!;
  expect(screen.querySelector<HTMLInputElement>("[data-testid='corpus-topic']")!.value).toBe("Workshop recording");
  click(screen.querySelector("[data-testid='corpus-submit']"));
  await flush();
  expect(saveImportSetup).toHaveBeenCalledWith("i1", expect.objectContaining({ topic: "Workshop recording", language: "en" }));
}

describe("the training corpus in the panel", () => {
  it("a saved set-up goes straight to judging, with its count", async () => {
    await setUp([PIECE("a"), PIECE("b")]);
    expect(judging()?.textContent).toBe("i1");
    expect(document.body.textContent).toContain("Set up · 2 moments");
  });

  it("a set-up with nothing to judge goes back to the imports, never to judging", async () => {
    await setUp([]);
    expect(judging()).toBeNull();
    expect(onImports()).not.toBeNull();
    expect(document.body.textContent).toContain("Set up · 0 moments");
  });

  it("a new import lands on the imports with its count", async () => {
    fetchTrainingImports.mockResolvedValue([]);
    importTrainingAudio.mockImplementation(async (input: { onAccepted?: () => void }) => {
      input.onAccepted?.();
      return { ok: true, queueCount: 3 };
    });
    act(() => root.render(<Host start={CORPUS} />));
    await flush();
    click(document.querySelector("[data-testid='corpus-import-button']"));
    const file = new File(["x"], "talk.mp3", { type: "audio/mpeg" });
    const input = document.querySelector<HTMLInputElement>("[data-testid='corpus-file-input']")!;
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    act(() => { input.dispatchEvent(new Event("change", { bubbles: true })); });
    const screen = document.querySelector("[data-testid='coach-panel-corpusimport']")!;
    type(screen.querySelector<HTMLInputElement>("[data-testid='corpus-topic']")!, "Keynote");
    choose(screen.querySelector<HTMLSelectElement>("[data-testid='corpus-language']")!, "en");
    click(screen.querySelector("[data-testid='corpus-submit']"));
    await flush();
    expect(importTrainingAudio).toHaveBeenCalledTimes(1);
    expect(importTrainingAudio).toHaveBeenCalledWith(expect.objectContaining({ file, topic: "Keynote", language: "en" }));
    expect(onImports()).not.toBeNull();
    expect(judging()).toBeNull();
    expect(document.body.textContent).toContain("Imported · 3 moments");
  });

  it("several files import one at a time, each its own import named by its file", async () => {
    fetchTrainingImports.mockResolvedValue([]);
    importTrainingAudio.mockImplementation(async (input: { file: File; onAccepted?: () => void }) => {
      input.onAccepted?.();
      if (input.file.name === "g10.mp4") return { ok: false, code: "AUDIO_REJECTED", error: "No speech in this file.", retryAfterSec: null };
      return { ok: true, queueCount: input.file.name === "g1.mp4" ? 2 : 3 };
    });
    await openImport();
    pick(["g10.mp4", "g2.mp4", "g1.mp4"].map((n) => new File(["x"], n, { type: "audio/mp4" })));
    const screen = document.querySelector("[data-testid='coach-panel-corpusimport']")!;
    expect(screen.querySelector("[data-testid='corpus-file']")!.textContent).toContain("3 files");
    await submit(screen, "FOSDEM");
    expect(importTrainingAudio.mock.calls.map(([i]) => [i.file.name, i.topic, i.language])).toEqual([
      ["g1.mp4", "FOSDEM · g1", "en"], ["g2.mp4", "FOSDEM · g2", "en"], ["g10.mp4", "FOSDEM · g10", "en"],
    ]);
    expect(onImports()).not.toBeNull();
    expect(document.body.textContent).toContain("Imported · 5 moments");
    expect(document.querySelector("[role='alert']")!.textContent).toBe("g10.mp4: No speech in this file.");
  });

  it("a choice over the upload limit is refused, and a refusal for the hour stops the batch", async () => {
    fetchTrainingImports.mockResolvedValue([]);
    importTrainingAudio.mockResolvedValue({ ok: false, code: "RATE_LIMITED", error: "Too many requests — slow down and try again.", retryAfterSec: 3000 });
    await openImport();
    pick(Array.from({ length: 201 }, (_, i) => new File(["x"], `g${i}.mp4`, { type: "audio/mp4" })));
    const screen = document.querySelector("[data-testid='coach-panel-corpusimport']")!;
    expect(screen.querySelector("[role='alert']")!.textContent).toBe("Up to 200 files at a time");
    expect(screen.querySelector("[data-testid='corpus-file']")!.textContent).toContain("Choose a file");
    pick(["a.mp4", "b.mp4", "c.mp4"].map((n) => new File(["x"], n, { type: "audio/mp4" })));
    await submit(screen, "FOSDEM");
    expect(importTrainingAudio).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[role='alert']")!.textContent)
      .toBe("a.mp4, b.mp4, c.mp4: Too many requests — slow down and try again.");
  });

  it("the done imports sit at the bottom, and judging goes on from one import to the next", async () => {
    const at = (sessionId: string, more: Partial<TrainingImport>): TrainingImport =>
      ({ ...IMPORT, sessionId, topic: sessionId, setupComplete: true, ...more });
    fetchTrainingImports.mockResolvedValue([
      at("done", { queueCount: 2, labelledCount: 2 }),
      at("first", { queueCount: 3, labelledCount: 0 }),
      at("unfinished", { setupComplete: false }),
      at("second", { queueCount: 1, labelledCount: 0 }),
    ]);
    act(() => root.render(<Host start={CORPUS} />));
    await flush();
    expect([...document.querySelectorAll("[data-walk-choice]")].map((c) => c.getAttribute("data-walk-choice")))
      .toEqual(["first", "unfinished", "second", "done"]);
    click(document.querySelector("[data-walk-choice='first']"));
    expect(judging()?.textContent).toBe("first");
    click(document.querySelector("[data-testid='stub-judged']"));
    await flush();
    // The unfinished set-up and the done import are passed over.
    expect(judging()?.textContent).toBe("second");
    click(document.querySelector("[data-testid='stub-judged']"));
    await flush();
    expect(judging()).toBeNull();
    expect(onImports()).not.toBeNull();
  });

  it("reaching the bottom of the list reads its next step", async () => {
    const waiting = (sessionId: string): TrainingImport =>
      ({ ...IMPORT, sessionId, topic: sessionId, setupComplete: true, queueCount: 2, labelledCount: 0 });
    let land!: (page: unknown) => void;
    fetchTrainingImportsPage
      .mockResolvedValueOnce({ imports: [waiting("first")], nextOffset: 1 })
      .mockReturnValueOnce(new Promise((r) => { land = r; }));
    act(() => root.render(<Host start={CORPUS} />));
    await flush();
    expect(choices()).toEqual(["first"]);
    act(() => { watchers.at(-1)!([{ isIntersecting: true }]); });
    expect(fetchTrainingImportsPage).toHaveBeenLastCalledWith(1);
    expect(document.querySelector("[data-testid='corpus-more'] [data-walk-loading]")).not.toBeNull();
    await act(async () => { land({ imports: [waiting("second")], nextOffset: null }); });
    expect(choices()).toEqual(["first", "second"]);
    expect(document.querySelector("[data-testid='corpus-more']")).toBeNull();
  });

  it("judging goes on into the next step of the list", async () => {
    const waiting = (sessionId: string): TrainingImport =>
      ({ ...IMPORT, sessionId, topic: sessionId, setupComplete: true, queueCount: 2, labelledCount: 0 });
    fetchTrainingImportsPage
      .mockResolvedValueOnce({ imports: [waiting("first")], nextOffset: 1 })
      .mockResolvedValueOnce({ imports: [waiting("later")], nextOffset: null });
    act(() => root.render(<Host start={CORPUS} />));
    await flush();
    click(document.querySelector("[data-walk-choice='first']"));
    click(document.querySelector("[data-testid='stub-judged']"));
    await flush();
    expect(judging()?.textContent).toBe("later");
  });

  it("the panel's queue read carries no words of a piece", () => {
    const piece = blindPiece(PIECE("a"));
    expect(piece.snippetId).toBe("a");
    expect("transcript" in piece).toBe(false);
    expect(JSON.stringify(piece)).not.toContain("SECRET WORDS");
  });

  it("a finished import's ⋯ → Edit opens its set-up filled in; Save renames it and goes back", async () => {
    const done = { ...IMPORT, setupComplete: true, speakerLabel: "Steve Jobs", queueCount: 4, labelledCount: 1 };
    const unfinished = { ...IMPORT, sessionId: "i2", topic: "Unfinished" };
    fetchTrainingImports.mockResolvedValue([done, unfinished]);
    act(() => root.render(<Host start={CORPUS} />));
    await flush();
    // An unfinished import opens its set-up on a tap: no ⋯ of its own.
    expect(document.querySelector("[aria-label='More options for Unfinished']")).toBeNull();
    click(document.querySelector("[aria-label='More options for Workshop recording']"));
    click(document.querySelector("[role='menuitem']"));
    await flush();
    const screen = document.querySelector("[data-testid='coach-panel-corpusimport']")!;
    expect(screen.querySelector("h2")!.textContent).toBe("Edit");
    expect(screen.querySelector("[data-testid='corpus-file']")).toBeNull();
    const topic = screen.querySelector<HTMLInputElement>("[data-testid='corpus-topic']")!;
    expect(topic.value).toBe("Workshop recording");
    expect(screen.querySelector<HTMLInputElement>("[data-testid='corpus-speaker']")!.value).toBe("Steve Jobs");
    type(topic, "Stanford commencement");
    const save = screen.querySelector<HTMLButtonElement>("[data-testid='corpus-submit']")!;
    expect(save.textContent).toBe("Save");
    click(save);
    await flush();
    expect(saveImportSetup).toHaveBeenCalledWith("i1", {
      topic: "Stanford commencement", language: "en", speakerLabel: "Steve Jobs", source: null,
    });
    // Back on the imports, read again so the card shows the new name.
    expect(fetchBlindConfidenceQueue).not.toHaveBeenCalled();
    expect(document.querySelector("[data-testid='coach-panel-corpushome']")).not.toBeNull();
    expect(fetchTrainingImports.mock.calls.length).toBeGreaterThan(1);
  });

  it("only the founder's ⋯ carries Delete; confirming it erases the import and reads the list again", async () => {
    const done = { ...IMPORT, setupComplete: true, queueCount: 4, labelledCount: 1 };
    fetchTrainingImports.mockResolvedValue([done]);
    signedInEmail = "coach@example.com";
    act(() => root.render(<Host start={CORPUS} />));
    await flush();
    click(document.querySelector("[aria-label='More options for Workshop recording']"));
    expect([...document.querySelectorAll("[role='menuitem']")].map((m) => m.textContent)).toEqual(["Edit"]);
    act(() => root.unmount());

    root = createRoot(host);
    signedInEmail = "artur@willonski.com";
    act(() => root.render(<Host start={CORPUS} />));
    await flush();
    click(document.querySelector("[aria-label='More options for Workshop recording']"));
    const items = [...document.querySelectorAll("[role='menuitem']")];
    expect(items.map((m) => m.textContent)).toEqual(["Edit", "Delete"]);
    click(items[1]!);
    const dialog = document.querySelector("[aria-labelledby='delete-project-title']")!;
    expect(dialog.querySelector("h2")!.textContent).toBe('Delete "Workshop recording"?');
    const reads = fetchTrainingImports.mock.calls.length;
    click([...dialog.querySelectorAll("button")].find((b) => b.textContent === "Delete")!);
    await flush();
    expect(eraseTrainingImport).toHaveBeenCalledWith("i1");
    expect(fetchTrainingImports.mock.calls.length).toBeGreaterThan(reads);
  });
});

function Host({ start }: { start: PanelState }) {
  const [state, setState] = useState(start);
  const dispatch = (a: PanelAction) => setState((s: PanelState) => panelReducer(s, a));
  return <CoachPanel state={state} dispatch={dispatch} speakers={[]} loading={false} />;
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
/** The bottom-of-list watchers the screens set up, newest last. */
const watchers: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
const choices = () => [...document.querySelectorAll("[data-walk-choice]")].map((c) => c.getAttribute("data-walk-choice"));
/** The imports, then Import audio. */
async function openImport(): Promise<void> {
  act(() => root.render(<Host start={CORPUS} />));
  await flush();
  click(document.querySelector("[data-testid='corpus-import-button']"));
}
/** Files chosen in the picker, as its onChange sees them. */
function pick(files: File[]): void {
  const input = document.querySelector<HTMLInputElement>("[data-testid='corpus-file-input']")!;
  Object.defineProperty(input, "files", { value: files, configurable: true });
  act(() => { input.dispatchEvent(new Event("change", { bubbles: true })); });
}
/** A topic, English, then Import. */
async function submit(screen: Element, topic: string): Promise<void> {
  type(screen.querySelector<HTMLInputElement>("[data-testid='corpus-topic']")!, topic);
  choose(screen.querySelector<HTMLSelectElement>("[data-testid='corpus-language']")!, "en");
  click(screen.querySelector("[data-testid='corpus-submit']"));
  await flush();
}
const click = (el: Element | null) => act(() => { (el as HTMLElement).click(); });
/** A chosen option, as React's onChange sees it. */
function choose(select: HTMLSelectElement, value: string): void {
  act(() => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
}
/** A typed value, as React's onChange sees it. */
function type(input: HTMLInputElement, value: string): void {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => { set.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
