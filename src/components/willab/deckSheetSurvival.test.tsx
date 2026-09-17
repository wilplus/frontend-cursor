// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  THE OPEN SHEET SURVIVES AN IDENTITY RE-MINT                                */
/*  (reported from real use 2026-09-16: "the overlay disappears when it's       */
/*  open")                                                                     */
/*                                                                            */
/*  The sheet was addressed by part id alone, and that id is not stable.       */
/*  `partsForDocument` honours the served ids only while they join back to the */
/*  served text, and otherwise re-derives through `reconcileParts`, which      */
/*  mints a fresh uuid for any paragraph it cannot match by exact words. So a  */
/*  background refetch could hand the same paragraph back under a new id, the  */
/*  lookup returned nothing, and the sheet unmounted mid-decision — with       */
/*  whatever had been typed into it.                                          */
/*                                                                            */
/*  A lock is FOLLOWED by a refetch (`setRefetchNonce` on success), so the     */
/*  window is widest at the moment the speaker has just decided something.     */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TranscriptReviewDeck from "./TranscriptReviewDeck";
import { buildDeckChunks, resolveOpenChunk } from "@/lib/willab/deckChunks";
import type { Part } from "@/lib/willab/documentParts";

vi.mock("./useConfidentMomentBundle", () => ({
  useConfidentMomentBundle: () => ({
    projection: null,
    status: "off",
    refresh: () => undefined,
  }),
}));
vi.mock("./ConfidentMomentCoachingBundle", () => ({ default: () => null }));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "t") }));

const SLIDES = [
  "Good morning. Today I want to show you how the pilot changed our numbers.",
  "Three things stood out: retention went up, churn went down, the team stayed calm.",
  "So here is what I am asking for: one more quarter of the same budget.",
];
const doc = SLIDES.join("\n\n");
const partsWith = (prefix: string): Part[] =>
  SLIDES.map((text, i) => ({ id: `${prefix}${i + 1}`, text, locked: false }));

Element.prototype.scrollTo = Element.prototype.scrollTo ?? (() => undefined);
Element.prototype.scrollIntoView =
  Element.prototype.scrollIntoView ?? (() => undefined);

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const props = (parts: Part[]) => ({
  title: "My Q3 pitch",
  document: doc,
  parts,
  suggestions: [],
  pieceSlideIndexes: [0, 1, 2],
  piecePartIds: parts.map((p) => p.id),
  slideTitles: ["Opening", "Results", "The ask"],
  onAccept: vi.fn(async () => true),
  onKeepMine: vi.fn(async () => true),
  onLockPart: vi.fn(async () => ({
    outcome: "ok" as const,
    rootPhraseProposal: null,
  })),
  onKeepEvolving: vi.fn(async () => "ok" as const),
  onSetRootPhrase: vi.fn(async () => true),
  onEditSlide: vi.fn(async () => true),
  onClose: vi.fn(),
});

async function render(parts: Part[]) {
  await act(async () => {
    root.render(
      createElement(TranscriptReviewDeck, props(parts) as never),
    );
  });
}

const sheetOpen = () =>
  Array.from(host.querySelectorAll("button")).some(
    (b) => (b.textContent ?? "").trim() === "Keep evolving",
  );

async function openFirstBookmark() {
  const mark = Array.from(host.querySelectorAll("button")).find((b) =>
    (b.getAttribute("aria-label") ?? "").startsWith("No feedback pending"),
  )!;
  await act(async () => {
    mark.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("the chunk sheet survives the document being re-derived under it", () => {
  it("stays open when every part id is re-minted but the words are unchanged", async () => {
    // THE BUG, exactly. Same document, same paragraphs, new uuids — which is
    // what a refetch produces whenever the served parts no longer join the
    // served text.
    await render(partsWith("old-"));
    await openFirstBookmark();
    expect(sheetOpen()).toBe(true);

    await render(partsWith("new-"));
    expect(sheetOpen()).toBe(true);
  });

  it("KEEPS WHAT WAS TYPED across the re-mint", async () => {
    // The worse half of the same bug. Keying the sheet on the live part id
    // meant a re-mint remounted it, and a remount re-seeds the draft from the
    // served words — so the sentence being written vanished with the sheet.
    // The sheet already re-syncs its draft when the served words change and
    // never over something typed, so it does not need the remount.
    await render(partsWith("old-"));
    await openFirstBookmark();
    const editor = host.querySelector(
      '[role="textbox"][contenteditable]',
    ) as HTMLElement;
    expect(editor).toBeTruthy();
    await act(async () => {
      editor.textContent = "A sentence the speaker was still writing.";
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await render(partsWith("new-"));
    expect(sheetOpen()).toBe(true);
    expect(
      (
        host.querySelector('[role="textbox"][contenteditable]') as HTMLElement
      )?.textContent,
    ).toContain("still writing");
  });

  it("closes when the paragraph it was opened on is genuinely gone", async () => {
    // The fallback resolves by position AND words, so it never re-adopts a
    // paragraph that is not the one the speaker opened.
    await render(partsWith("old-"));
    await openFirstBookmark();
    expect(sheetOpen()).toBe(true);

    await act(async () => {
      root.render(
        createElement(TranscriptReviewDeck, {
          ...props([{ id: "x1", text: SLIDES[2], locked: false }]),
          document: SLIDES[2],
          pieceSlideIndexes: [0],
          piecePartIds: ["x1"],
          slideTitles: ["The ask"],
        } as never),
      );
    });
    expect(sheetOpen()).toBe(false);
  });
});

describe("resolveOpenChunk — position + words, never a guess", () => {
  const chunks = (parts: Part[]) => buildDeckChunks(doc, parts, []);
  const ref = (parts: Part[], i: number) => ({
    id: parts[i].id,
    index: i,
    text: parts[i].text.trim(),
  });

  it("prefers the id when it still resolves", () => {
    const parts = partsWith("a-");
    const found = resolveOpenChunk(chunks(parts), ref(parts, 1));
    expect(found?.part.id).toBe("a-2");
  });

  it("falls back to position + words after a re-mint", () => {
    const opened = ref(partsWith("a-"), 1);
    const found = resolveOpenChunk(chunks(partsWith("b-")), opened);
    expect(found?.part.id).toBe("b-2");
    expect(found?.paragraphIndex).toBe(1);
  });

  it("refuses a paragraph whose WORDS changed at that position", () => {
    // Re-adopting here would hand the sheet a paragraph the speaker never
    // opened — the same "never re-point a moved anchor" rule the lock follows.
    const opened = ref(partsWith("a-"), 1);
    const moved = doc.replace(SLIDES[1], "Something else entirely happened.");
    const chunksAfter = buildDeckChunks(
      moved,
      [
        { id: "b-1", text: SLIDES[0], locked: false },
        { id: "b-2", text: "Something else entirely happened.", locked: false },
        { id: "b-3", text: SLIDES[2], locked: false },
      ],
      [],
    );
    expect(resolveOpenChunk(chunksAfter, opened)).toBeNull();
  });

  it("refuses the same words at a DIFFERENT position", () => {
    const opened = { id: "gone", index: 0, text: SLIDES[1].trim() };
    expect(resolveOpenChunk(chunks(partsWith("c-")), opened)).toBeNull();
  });

  it("is null for nothing open, and for an empty deck", () => {
    expect(resolveOpenChunk(chunks(partsWith("d-")), null)).toBeNull();
    expect(resolveOpenChunk([], ref(partsWith("d-"), 0))).toBeNull();
  });
});
