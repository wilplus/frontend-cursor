// @vitest-environment jsdom
/* The training corpus inside the panel, its host's flow (D-CP-20 review): a
   saved set-up goes straight to judging with "Set up · {n} moments", an
   import lands on the imports with "Imported · {n} moments", an import with
   nothing to judge is never judged, the panel's Judge reads the queue
   without a piece's words, a finished import's ⋯ → Edit renames it, and
   only the founder's ⋯ carries Delete, which erases the import. */
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchTrainingImports = vi.fn();
const saveImportSetup = vi.fn();
const fetchBlindConfidenceQueue = vi.fn();
const importTrainingAudio = vi.fn();
const eraseTrainingImport = vi.fn();
let signedInEmail: string | null = null;
vi.mock("../useUserEmail", () => ({ useUserEmail: () => signedInEmail }));
vi.mock("@/services/api/trainingCorpus", async (orig) => ({
  ...(await orig<typeof import("@/services/api/trainingCorpus")>()),
  fetchTrainingImports: (...a: unknown[]) => fetchTrainingImports(...a),
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
  default: ({ importId }: { importId: string }) => <div data-testid="stub-corpus-judge">{importId}</div>,
}));
import { blindPiece, type QueuePiece } from "@/services/api/trainingCorpus";
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

describe("the training corpus in the panel", () => {

  it("the panel's queue read carries no words of a piece", () => {
    const piece = blindPiece(PIECE("a"));
    expect("transcript" in piece).toBe(false);
    expect(JSON.stringify(piece)).not.toContain("SECRET WORDS");
  });

  it("a finished import's ⋯ → Edit opens its set-up filled in; Save renames it and goes back", async () => {
    const done = { ...IMPORT, setupComplete: true, speakerLabel: "Steve Jobs", queueCount: 4, labelledCount: 1 };
    const unfinished = { ...IMPORT, sessionId: "i2", topic: "Unfinished" };
    fetchTrainingImports.mockResolvedValue([done, unfinished]);
    act(() => root.render(<Host start={[{ type: "open" }, { type: "corpus" }]
      .reduce((s, a) => panelReducer(s, a as PanelAction), PANEL_START)} />));
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
    const start = [{ type: "open" }, { type: "corpus" }].reduce((s, a) => panelReducer(s, a as PanelAction), PANEL_START);
    signedInEmail = "coach@example.com";
    act(() => root.render(<Host start={start} />));
    await flush();
    click(document.querySelector("[aria-label='More options for Workshop recording']"));
    expect([...document.querySelectorAll("[role='menuitem']")].map((m) => m.textContent)).toEqual(["Edit"]);
    act(() => root.unmount());

    root = createRoot(host);
    signedInEmail = "artur@willonski.com";
    act(() => root.render(<Host start={start} />));
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
const click = (el: Element | null) => act(() => { (el as HTMLElement).click(); });
/** A typed value, as React's onChange sees it. */
function type(input: HTMLInputElement, value: string): void {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => { set.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
