// @vitest-environment jsdom
/*
STORY    As a speaker, I want editing a slide to save only the paragraphs I
         changed, so that the others keep their locks and history.
OUTCOME
  O1  Save sends only the changed paragraph, with its new words.
  O2  Back, X and Cancel keep my draft when saving fails.
  O3  Leaving while a save is running sends no duplicate request.
  O4  Browser Back saves before closing the editor.
PROVES   O1 -> "writes only the paragraphs whose words changed"
         O2 -> "keeps my draft when leaving through %s fails"
         O3 -> "deduplicates a second exit while Save is in flight"
         O4 -> "registers browser Back with the same guard"
WHY      Never 5 (every old version stays in the history).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pdfSlides", () => ({
  PdfPage: () => createElement("div", { "data-testid": "slide-picture" }),
  MockPresentationSlide: () => createElement("div", { "data-testid": "slide-picture" }),
  SlideRender: () => createElement("div", { "data-testid": "slide-picture" }),
}));
vi.mock("./MarkedEditor", () => ({
  default: ({ value, onChange, frameClass }: { value: string; onChange: (v: string) => void; frameClass: string }) =>
    createElement("textarea", {
      "data-testid": "paragraph-card",
      "data-frame": frameClass,
      value,
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    }),
}));

import { SlideEditor } from "./TranscriptReviewDeck";
import type { DeckChunk } from "@/lib/willab/deckChunks";

const chunk = (id: string, text: string) => ({ part: { id, text, locked: false } }) as unknown as DeckChunk;
const CHUNKS = [chunk("p1", "We started in a garage."), chunk("p2", "Nobody believed us.")];

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    root = createRoot(host);
  });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(
  onSave = vi.fn(async (_e: unknown) => true),
  onCancel = vi.fn(),
  onRegisterBack?: (guard: (() => boolean) | null) => void,
) {
  act(() =>
    root.render(createElement(SlideEditor, { where: "Slide 2", chunks: CHUNKS, onCancel, onSave, onRegisterBack })),
  );
  return { onSave, onCancel };
}

const button = (label: string) =>
  [...host.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").trim() === label || b.getAttribute("aria-label") === label,
  ) as HTMLButtonElement;

function type(index: number, text: string) {
  const area = host.querySelectorAll<HTMLTextAreaElement>('[data-testid="paragraph-card"]')[index];
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    setter.call(area, text);
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("the slide editor", () => {

  it("writes only the paragraphs whose words changed", async () => {
    const { onSave } = render();
    type(1, "Nobody believed us at first.");
    await act(async () => button("Save").click());
    expect(onSave).toHaveBeenCalledTimes(1);
    const edits = onSave.mock.calls[0][0] as Array<{ chunk: DeckChunk; text: string }>;
    expect(edits.map((e) => [e.chunk.part.id, e.text])).toEqual([["p2", "Nobody believed us at first."]]);
  });

  it.each(["Back", "Close", "Cancel"])("keeps my draft when leaving through %s fails", async (exit) => {
    const onSave = vi.fn(async () => false);
    const { onCancel } = render(onSave);
    type(1, "Nobody believed us at first.");

    await act(async () => button(exit).click());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="slide-editor-failed"]')?.textContent).toContain(
      "Your edits are still here",
    );

    // A deliberate retry saves the same words, then closes only on success.
    onSave.mockResolvedValueOnce(true);
    await act(async () => button("Save").click());
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[1]).toEqual(onSave.mock.calls[0]);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("deduplicates a second exit while Save is in flight", async () => {
    let resolveSave!: (ok: boolean) => void;
    const onSave = vi.fn(
      () => new Promise<boolean>((resolve) => { resolveSave = resolve; }),
    );
    const { onCancel } = render(onSave);
    type(1, "Nobody believed us at first.");

    act(() => button("Save").click());
    act(() => button("Close").click());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    await act(async () => resolveSave(true));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("registers browser Back with the same guard", async () => {
    let guard: (() => boolean) | null = null;
    const onSave = vi.fn(async () => true);
    const { onCancel } = render(onSave, vi.fn(), (next) => { guard = next; });
    type(1, "Nobody believed us at first.");
    expect(guard).not.toBeNull();
    await act(async () => {
      expect(guard!()).toBe(true);
      await Promise.resolve();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
