// @vitest-environment jsdom
/* The slide editor, drawn like Ideal Text Final Screens' editor frame (build
   plan D-IT-4): a full-screen sheet with a top bar ("Edit the text" over
   "Slide n", and ✕), the paragraph cards, the signed note, a black Save pill
   with a grey Cancel link under it, and no slide picture. The write is
   unchanged: only the paragraphs whose words changed go to the host. */
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
import { CHUNK_SHEET_COPY } from "./idealEditCopy";
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

function render(onSave = vi.fn(async (_e: unknown) => true), onCancel = vi.fn()) {
  act(() =>
    root.render(createElement(SlideEditor, { where: "Slide 2", chunks: CHUNKS, onCancel, onSave })),
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
  it("is a full-screen sheet: top bar, cards, the note, Save over Cancel, no slide picture", () => {
    render();
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-label")).toBe("Edit the text");
    expect(dialog.className).toMatch(/fixed inset-0/);
    expect(dialog.className).not.toMatch(/max-h-\[82dvh\]|rounded-t-3xl/);
    const bar = dialog.firstElementChild!;
    expect(bar.querySelector("h2")?.textContent).toBe("Edit the text");
    expect(bar.querySelector("p")?.textContent).toBe("Slide 2");
    expect(bar.querySelector('button[aria-label="Close"]')).not.toBeNull();
    expect(host.querySelectorAll('[data-testid="paragraph-card"]')).toHaveLength(2);
    expect(dialog.textContent).toContain(CHUNK_SHEET_COPY.editorNextTakeNote);
    expect(host.querySelector('[data-testid="slide-picture"]')).toBeNull();
    const save = button("Save");
    const cancel = button("Cancel");
    expect(save.className).toMatch(/rounded-full bg-foreground/);
    expect(cancel.className).toMatch(/text-muted-foreground/);
    expect(cancel.className).not.toMatch(/border|bg-/);
    // Cancel sits under Save.
    expect(save.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("writes only the paragraphs whose words changed", async () => {
    const { onSave } = render();
    type(1, "Nobody believed us at first.");
    await act(async () => button("Save").click());
    expect(onSave).toHaveBeenCalledTimes(1);
    const edits = onSave.mock.calls[0][0] as Array<{ chunk: DeckChunk; text: string }>;
    expect(edits.map((e) => [e.chunk.part.id, e.text])).toEqual([["p2", "Nobody believed us at first."]]);
  });

  it("says so when the save fails, and keeps the edits", async () => {
    render(vi.fn(async () => false));
    type(0, "We began in a garage.");
    await act(async () => button("Save").click());
    const line = host.querySelector('[data-testid="slide-editor-failed"]');
    expect(line?.textContent).toBe("Couldn't save this slide. Your edits are still here.");
    expect(host.querySelector<HTMLTextAreaElement>('[data-testid="paragraph-card"]')?.value).toBe(
      "We began in a garage.",
    );
    expect(button("Save").disabled).toBe(false);
  });

  it("closes from the ✕ and from Cancel", () => {
    const { onCancel } = render();
    act(() => button("Close").click());
    act(() => button("Cancel").click());
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("will not save an emptied paragraph", () => {
    render();
    type(0, "   ");
    expect(button("Save").disabled).toBe(true);
  });
});
