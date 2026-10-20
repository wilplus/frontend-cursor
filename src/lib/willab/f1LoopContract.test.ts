// @vitest-environment jsdom
/*
STORY    As the founder, I want one gate that turns red when the loop's promises
         break (true paragraph states, no numbers to speakers, the page only
         shows what the server said), so that parallel work can't quietly
         break the loop.
OUTCOME
  O1  Each of the four paragraph states (untouched, clean, waiting, locked) is
      reached from what the speaker and the server actually did.
  O2  No speaker screen shows a measured number (Hz/dB/wpm or a raw count).
      Never-1: no scores, numbers or verdicts shown to speakers.
  O3  The feedback slot is held only while the server says feedback is coming.
PROVES   O1 -> "each paragraph lands in the state the speaker put it in"
         O2 -> "the retired /recordings/[id] page sends the speaker to the Lounge, not to a number"
         O3 -> "reserves a bookmark's place only while the server says it is coming"
WHY      Founder 2026-09-22: a gate parallel sessions run, not a document they
         skip. Twin: backend tests/test_f1_loop_contract.py. The wait bar's
         ceiling lives in waitProgress.test.ts.
*/
import { describe, expect, it, vi } from "vitest";

import { buildDeckChunks } from "./deckChunks";
import type { Part } from "./documentParts";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
}));

// ══════════════════════════════════════════════════════════════════════════
//  1. A PARAGRAPH'S STATE IS THE ONE THE SPEAKER PUT IT IN
// ══════════════════════════════════════════════════════════════════════════

describe("the four states of a paragraph", () => {
  it("each paragraph lands in the state the speaker put it in", () => {
    const words = [
      "Nothing happened here.",
      "I accepted a change here.",
      "Feedback waits here.",
      "I locked this one in.",
    ];
    const doc = words.join("\n\n");
    const span = (i: number) => {
      const start = doc.indexOf(words[i]);
      return { start, end: start + words[i].length };
    };
    const parts: Part[] = words.map((text, i) => ({
      id: `part-${i}`,
      text,
      locked: i === 3,
    }));
    const chunks = buildDeckChunks(doc, parts, [
      { id: "decided", ...span(1), status: "approved" },
      { id: "open", ...span(2), status: null },
    ]);
    expect(chunks.map((c) => c.status)).toEqual([
      "untouched",
      "clean",
      "waiting",
      "locked",
    ]);
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  2. NO NUMBER REACHES A SPEAKER (AC-9)
// ══════════════════════════════════════════════════════════════════════════

describe("AC-9: the read a speaker sees is in words", () => {
  it("the retired /recordings/[id] page sends the speaker to the Lounge, not to a number", async () => {
    /* The old recording page drew the machine's wpm and filler count as big
       numbers (CompletedCard). It is retired (WIL-78, founder 2026-10-19):
       opening it redirects to the Lounge and renders nothing of its own. */
    const { redirect } = await import("next/navigation");
    const { default: RetiredRecordingPage } = await import(
      "@/app/(protected)/recordings/[id]/page"
    );
    expect(() => RetiredRecordingPage()).toThrow("NEXT_REDIRECT /chat");
    expect(redirect).toHaveBeenCalledWith("/chat");
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  3. THE PAGE ASKS THE SERVER, IT DOES NOT DECIDE FOR IT
// ══════════════════════════════════════════════════════════════════════════

describe("the page never invents what the server did not say", () => {
  it("reserves a bookmark's place only while the server says it is coming", async () => {
    const { feedbackStillComing } = await import("./enrichmentSettle");
    expect(feedbackStillComing({ document_layers: { retryable: true } }))
      .toBe(true);
    expect(feedbackStillComing({ document_layers: {}, feedback: {} }))
      .toBe(false);
    // A section that puts nothing on the page never holds the slot open.
    expect(feedbackStillComing({ learning: { retryable: true } })).toBe(false);
  });
});
