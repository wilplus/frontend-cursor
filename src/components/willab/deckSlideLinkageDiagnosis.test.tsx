// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  WHEN THE DECK FLATTENS, IT SAYS WHY                                        */
/*  (founder 2026-09-18: "after a lock the text skipped the slides and got     */
/*  concatenated again")                                                       */
/*                                                                            */
/*  `groupChunksBySlide` distinguishes seven typed failures. Every one of them */
/*  produced the SAME screen — one unlinked "Your talk" section holding the    */
/*  whole document, no slide kickers, and (because the preview is rendered per */
/*  slide group) no slide picture either. The reason was computed and dropped, */
/*  so a stale slide map, a lock that re-minted a part id, and a backwards     */
/*  mapping were indistinguishable from the outside.                          */
/*                                                                            */
/*  The degrade itself is correct and stays: a provenance defect must not      */
/*  replace the speaker's words with an error. What is fixed is its silence.   */
/*                                                                            */
/*  THE PRODUCTION CASE IS `missing_parent_slide` AT INDEX 0. A snapshot       */
/*  published before backend #539 carries `slide_index: null` on every piece;  */
/*  the first paragraph then has no real parent slide to inherit, and the      */
/*  whole document collapses. The core GET serves one immutable snapshot and   */
/*  explicitly does not repair, so that document stays flat on every reload.   */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TranscriptReviewDeck from "./TranscriptReviewDeck";
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
const parts: Part[] = SLIDES.map((text, i) => ({
  id: `p${i + 1}`,
  text,
  locked: false,
}));

Element.prototype.scrollTo = Element.prototype.scrollTo ?? (() => undefined);
Element.prototype.scrollIntoView =
  Element.prototype.scrollIntoView ?? (() => undefined);

let root: Root;
let host: HTMLDivElement;
let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  warn.mockRestore();
});

const base = {
  title: "My Q3 pitch",
  document: doc,
  parts,
  suggestions: [],
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
};

async function render(extra: Record<string, unknown>) {
  await act(async () => {
    root.render(
      createElement(TranscriptReviewDeck, { ...base, ...extra } as never),
    );
  });
  return host.querySelector("[data-slide-linkage]")!;
}

describe("a flattened deck names its reason", () => {
  it("reports missing_parent_slide when the snapshot lost every slide index", async () => {
    // Exactly the poisoned payload: pieces present, slide_index null on all.
    const deck = await render({ pieceSlideIndexes: [null, null, null] });

    expect(deck.getAttribute("data-slide-linkage")).toBe("unlinked");
    expect(deck.getAttribute("data-slide-linkage-reason")).toBe(
      "missing_parent_slide",
    );
    // The first paragraph is where it became unprovable, and the one to look
    // at in the payload.
    expect(deck.getAttribute("data-slide-linkage-at")).toBe("0");
  });

  it("reports missing_slide_mapping when the pieces block is absent entirely", async () => {
    const deck = await render({ pieceSlideIndexes: null });

    expect(deck.getAttribute("data-slide-linkage")).toBe("unlinked");
    expect(deck.getAttribute("data-slide-linkage-reason")).toBe(
      "missing_slide_mapping",
    );
  });

  it("distinguishes a lock that re-minted a part id", async () => {
    const deck = await render({
      pieceSlideIndexes: [0, 1, 2],
      piecePartIds: ["p1", "MINTED-AFTER-LOCK", "p3"],
    });

    expect(deck.getAttribute("data-slide-linkage-reason")).toBe(
      "piece_identity_mismatch",
    );
    expect(deck.getAttribute("data-slide-linkage-at")).toBe("1");
  });

  it("still shows every word — the degrade is not an error screen", async () => {
    await render({ pieceSlideIndexes: [null, null, null] });
    // The speaker's document is intact on screen; only its slide linkage is
    // missing. This is the 2026-08-26 rule and it must not regress into
    // "Couldn't load your ideal text."
    const shown = host.textContent ?? "";
    for (const slide of SLIDES) {
      expect(shown).toContain(slide.slice(0, 40));
    }
  });

  it("logs the reason once, for a device with no inspector", async () => {
    await render({ pieceSlideIndexes: [null, null, null] });

    const call = warn.mock.calls.find((c: unknown[]) =>
      String(c[0]).includes("slide grouping failed"),
    );
    expect(call, "no diagnostic was logged").toBeTruthy();
    expect(call![1]).toMatchObject({
      reason: "missing_parent_slide",
      paragraphIndex: 0,
      partId: "p1",
      chunks: 3,
      slideCount: 3,
    });
  });
});

describe("a healthy deck stays quiet", () => {
  it("links the slides and carries no reason", async () => {
    const deck = await render({ pieceSlideIndexes: [0, 1, 2] });

    expect(deck.getAttribute("data-slide-linkage")).toBe("linked");
    expect(deck.getAttribute("data-slide-linkage-reason")).toBeNull();
    expect(deck.getAttribute("data-slide-linkage-at")).toBeNull();
    expect(
      warn.mock.calls.filter((c: unknown[]) =>
        String(c[0]).includes("slide grouping failed"),
      ),
    ).toHaveLength(0);
  });
});
