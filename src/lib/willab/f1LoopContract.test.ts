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
         O2 -> "KNOWN BREACH Never-1: ..." (it.fails until CompletedCard drops it)
         O3 -> "reserves a bookmark's place only while the server says it is coming"
WHY      Founder 2026-09-22: a gate parallel sessions run, not a document they
         skip. Twin: backend tests/test_f1_loop_contract.py. The wait bar's
         ceiling lives in waitProgress.test.ts.
*/
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { buildDeckChunks } from "./deckChunks";
import type { Part } from "./documentParts";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api/client", () => ({
  fetchSignedAudioUrl: vi.fn(() => new Promise(() => undefined)),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

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
  it.fails(
    "KNOWN BREACH Never-1: /recordings/[id] shows words per minute and a filler count (CompletedCard.tsx:96,100)",
    async () => {
      /* The signed-in recording page renders CompletedCard, which draws the
         machine's wpm and filler count as big numbers. Render it with a
         recording the backend could send and read what the speaker sees. */
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
      const { default: CompletedCard } = await import("@/components/session/CompletedCard");
      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);
      try {
        await act(async () => {
          root.render(
            createElement(CompletedCard, {
              recording: {
                recording_id: "rec-1",
                session_id: "ses-1",
                status: "completed",
                transcription_text: "We started in a garage.",
                metrics: { wpm: 184, filler_count: 7, filler_breakdown: {} },
                analysis: { report: "You kept a steady pace through the opening." },
                answers: { pre: [], post: [] },
              } as never,
            }),
          );
        });
        const seen = host.textContent ?? "";
        // The words are there, so this cannot pass on an empty screen.
        expect(seen).toContain("You kept a steady pace through the opening.");
        expect(seen).not.toMatch(/Words Per Minute|\bwpm\b|\bHz\b|\bdB\b/i);
        expect(seen).not.toContain("184");
        expect(seen).not.toContain("7");
      } finally {
        act(() => root.unmount());
        host.remove();
      }
    },
  );
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
