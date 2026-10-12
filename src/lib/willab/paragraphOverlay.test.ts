/* The paragraph overlay's rules (founder lock 2026-09-30, B5, D1, D3, D7,
   Q1): which card, which button, which colour, and the History rows. Pure,
   so the sheet stays a renderer. */
import { describe, expect, it } from "vitest";
import type { DocumentSuggestion } from "@/services/api/idealText";
import {
  nextOpensPicker,
  feedbackFirstCard,
  feedbackFirstFooter,
} from "./paragraphOverlay";

const TEXT = "We should ship it now because the data is clear.";

function item(over: Partial<DocumentSuggestion>): DocumentSuggestion {
  return {
    id: "s",
    start: 0,
    end: 21,
    quote: "We should ship it now",
    kind: "advice",
    proposedText: null,
    device: null,
    status: "dismissed",
    ...over,
  } as DocumentSuggestion;
}

const moment = item({
  id: "cv",
  feedbackFamily: "confident_voice",
  source: "confident_voice",
  snippetId: "snip",
  evidence: { projectId: "a", takeSessionId: "t", slideIndex: 0, paragraphIndex: 0, start: 0, end: 21 },
} as unknown as Partial<DocumentSuggestion>);
const rewrite = item({
  id: "rw",
  feedbackFamily: "rewrite_clarity",
  kind: "replace",
  proposedText: "because the numbers back it",
});

describe("the button (B5 as overridden, Q1 B, D3)", () => {
  it("Next opens the helper words on unsaved words only (24e, B2)", () => {
    // Which answers open them is proven on the rendered sheet
    // (judgementFollowUpWalk.test.tsx); saved words are left here.
    expect(nextOpensPicker("yes", "ship it")).toBe(false);
  });
});

/* JUDGEMENT AFTER FEEDBACK (24e-1; Phase 6): the card and the button before
   any judgement. */
describe("feedback first", () => {
  const tier = (item: DocumentSuggestion, bookmarkTier: "confident" | "weak") =>
    ({ ...item, bookmarkTier }) as DocumentSuggestion;

  it("a moment that needed work opens on its exercise, else its rewrite, else itself", () => {
    // The exercise is proven on the rendered sheet (feedbackFirst.test.tsx).
    expect(feedbackFirstCard([tier(moment, "weak"), rewrite], "weak", TEXT)?.kind).toBe("rewrite");
    expect(feedbackFirstCard([tier(moment, "weak")], "weak", TEXT)?.kind).toBe("plain");
    expect(feedbackFirstFooter("weak", true, false)).toEqual({ pill: "practise", link: "skip" });
    expect(feedbackFirstFooter("weak", true, true)).toEqual({ pill: "accept", link: "keep" });
  });
});
