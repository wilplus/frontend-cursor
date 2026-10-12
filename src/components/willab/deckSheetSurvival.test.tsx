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
import type { Part } from "@/lib/willab/documentParts";

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
    // A clip: a Confident Voice item nobody can hear is not asked (2026-09-29).
    snippetAudioRef: "https://media/moment.wav",
    startOffsetMs: 0,
    durationMs: 9000,
  },
];
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
});
