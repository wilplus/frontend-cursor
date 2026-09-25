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
/* SINCE 2026-09-17 A BOOKMARK ONLY APPEARS WHERE A CONFIDENT VOICE JUDGEMENT
   IS WAITING (founder: "visibility and openability of the overlay is strictly
   for the confident voice... first you see the confident voice and then
   eventually emphasis or a rewrite or an exercise, but first your voice").
   These walks open the sheet by tapping one, so the paragraph they tap needs
   a Confident Voice item — a rewrite alone no longer paints a mark. */
const offset = doc.indexOf("retention went up");
const SUGGESTIONS = [
  {
    id: "s-rw",
    start: offset,
    end: offset + "retention went up".length,
    quote: "retention went up",
    kind: "replace",
    proposedText: "retention rose",
    source: "confident_voice",
    feedbackFamily: "confident_voice",
    device: null,
    tentative: true,
    status: null,
  },
];
const partsWith = (prefix: string): Part[] =>
  SLIDES.map((text, i) => ({ id: `${prefix}${i + 1}`, text, locked: false }));
/** Paragraph 0 LOCKED and un-suggested: it carries a bookmark (something was
 *  decided) and its sheet opens on the EDITOR face, which is the one with a
 *  field to type into. */
const partsLockedFirst = (prefix: string): Part[] =>
  SLIDES.map((text, i) => ({ id: `${prefix}${i + 1}`, text, locked: i === 0 }));

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
  suggestions: SUGGESTIONS,
  pieceSlideIndexes: [0, 1, 2],
  piecePartIds: parts.map((p) => p.id),
  slideTitles: ["Opening", "Results", "The ask"],
  onAccept: vi.fn(async () => true),
  onKeepMine: vi.fn(async () => true),
  onLockPart: vi.fn(async () => ({
    outcome: "ok" as const,
    rootPhraseProposal: null,
  })),
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

/* THE SHEET ITSELF, not one of its buttons. The footer differs by face — a
   paragraph with a pending item opens on the review face, a settled one on the
   editor — and keying the probe to one face made these walks depend on the
   fixture's inventory rather than on the sheet being open. */
const sheetOpen = () => host.querySelector('[role="dialog"]') !== null;

async function openBookmark(labelPrefix = "Feedback waiting") {
  const mark = Array.from(host.querySelectorAll("button")).find((b) =>
    (b.getAttribute("aria-label") ?? "").startsWith(labelPrefix),
  )!;
  expect(mark, `no "${labelPrefix}" bookmark — check the fixture`).toBeTruthy();
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
    await openBookmark();
    expect(sheetOpen()).toBe(true);

    await render(partsWith("new-"));
    expect(sheetOpen()).toBe(true);
  });

  it("is the SAME sheet afterwards — it does not remount", async () => {
    // The worse half of the same bug, and the reason the sheet is keyed on the
    // OPENING rather than the live part id. A remount re-seeds the sheet from
    // the served words, so a sentence being written into it disappears even
    // when the sheet itself survives.
    //
    // NODE IDENTITY IS THE PROOF. React reuses the same DOM element when a
    // component instance survives a re-render and creates a new one when the
    // key changes. So "same object after the re-mint" IS "did not remount",
    // asserted without depending on which face of the ladder is showing or
    // where its editable field lives.
    await render(partsWith("old-"));
    await openBookmark();
    const before = host.querySelector('[role="dialog"]');
    expect(before).toBeTruthy();

    await render(partsWith("new-"));
    const after = host.querySelector('[role="dialog"]');
    expect(after).toBeTruthy();
    expect(after).toBe(before);
  });

  it("closes when the paragraph it was opened on is genuinely gone", async () => {
    // The fallback resolves by position AND words, so it never re-adopts a
    // paragraph that is not the one the speaker opened.
    await render(partsWith("old-"));
    await openBookmark();
    expect(sheetOpen()).toBe(true);

    await act(async () => {
      root.render(
        createElement(TranscriptReviewDeck, {
          ...props([{ id: "x1", text: SLIDES[2], locked: false }]),
          suggestions: [],
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
