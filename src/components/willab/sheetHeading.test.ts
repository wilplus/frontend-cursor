/* -------------------------------------------------------------------------- */
/*  The chunk sheet's heading — founder copy, now reachable by a test.          */
/*                                                                            */
/*  This file exists for the reason sheetHeading.ts was split out at all: the  */
/*  strings are signed-off copy (LIVE LOOP) and they used to sit inside a      */
/*  .tsx that vitest cannot transform here, so nothing could assert them.      */
/*  A source grep can tell you a string is present; only this can tell you     */
/*  which face actually shows it.                                             */
/* -------------------------------------------------------------------------- */
import { describe, expect, it } from "vitest";

import { sheetHeading } from "./sheetHeading";
import type { DocumentSuggestion } from "@/services/api/idealText";

function item(over: Partial<DocumentSuggestion>): DocumentSuggestion {
  return {
    id: "s-1",
    start: 0,
    end: 10,
    quote: "we should ship",
    kind: "advice",
    proposedText: null,
    device: null,
    ...over,
  } as DocumentSuggestion;
}

const base = {
  suggestion: null,
  locked: false,
  hasApproved: false,
  iteration: 0,
} as const;

describe("the chunk sheet heading", () => {
  /* ---------------------------------------------------------------------- */
  /*  The 2026-09-15 founder ruling                                          */
  /* ---------------------------------------------------------------------- */

  it("gives the Confident Voice face one plain word and NO kicker", () => {
    // "there should be no title above, just a small feedback. And then the
    // playback, and that's it, a very minimalistic design."
    const heading = sheetHeading({
      ...base,
      face: "review",
      suggestion: item({ feedbackFamily: "confident_voice" }),
    });
    expect(heading.kicker).toBeNull();
    expect(heading.title).toBe("Feedback");
  });

  it("recognises the lane by source as well as family", () => {
    // The wire carries confident voice as kind 'bold' with source set, so a
    // family-only check would leave those items wearing the old header.
    const heading = sheetHeading({
      ...base,
      face: "review",
      suggestion: item({ kind: "bold", source: "confident_voice" }),
    });
    expect(heading.kicker).toBeNull();
    expect(heading.title).toBe("Feedback");
  });

  it("gives EVERY feedback face a bare header, keeping its own title", () => {
    // Founder 2026-09-15: "make all feedback cards bare … delete the text
    // POSSIBLE CLARITY IMPROVEMENT". The kind eyebrow is gone from all of
    // them; the title is not — e2e/ideal-text-canonical.spec.mjs waits on
    // "Suggested change" against a rewrite item, so dropping that too would
    // take the blocking e2e tier down with it.
    for (const family of ["rewrite_clarity", "great_formulation"]) {
      const heading = sheetHeading({
        ...base,
        face: "review",
        suggestion: item({ feedbackFamily: family } as Partial<DocumentSuggestion>),
      });
      expect(heading.title).toBe("Suggested change");
      expect(heading.kicker).toBeNull();
    }
  });

  it("never names the lane on an opened sheet, whatever the iteration", () => {
    // The iteration tail used to ride the kicker, so a chunk with history
    // could reintroduce an eyebrow through the back door.
    const heading = sheetHeading({
      ...base,
      face: "review",
      iteration: 4,
      suggestion: item({ feedbackFamily: "rewrite_clarity" } as Partial<DocumentSuggestion>),
    });
    expect(heading.kicker).toBeNull();
    expect(heading.title).toBe("Suggested change");
  });

  /* ---------------------------------------------------------------------- */
  /*  The editor faces                                                       */
  /* ---------------------------------------------------------------------- */

  it("says a locked chunk is locked, and an accepted one is not yet", () => {
    expect(sheetHeading({ ...base, face: "editor", locked: true })).toEqual({
      kicker: "Locked in",
      title: "Locked chunk",
    });
    // Read off the approved rider, never off a status that can no longer say
    // "accepted" — the 2026-08-15 lesson this heading was nearly retired by.
    expect(
      sheetHeading({ ...base, face: "editor", hasApproved: true }),
    ).toEqual({
      kicker: "Accepted · not locked in yet",
      title: "Edit this chunk",
    });
    expect(sheetHeading({ ...base, face: "editor" })).toEqual({
      kicker: "No feedback pending",
      title: "Edit this chunk",
    });
  });

  it("counts iterations in the kicker, and pluralises them", () => {
    expect(
      sheetHeading({ ...base, face: "editor", locked: true, iteration: 1 })
        .kicker,
    ).toBe("Locked in · 1 iteration");
    expect(
      sheetHeading({ ...base, face: "editor", locked: true, iteration: 3 })
        .kicker,
    ).toBe("Locked in · 3 iterations");
    // Zero is silent rather than "0 iterations".
    expect(
      sheetHeading({ ...base, face: "editor", locked: true }).kicker,
    ).toBe("Locked in");
  });

  it("names the root face", () => {
    expect(sheetHeading({ ...base, face: "root", iteration: 2 })).toEqual({
      kicker: "Locked for the next Take · 2 iterations",
      title: "Choose a rooting phrase",
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  AC-9                                                                   */
  /* ---------------------------------------------------------------------- */

  it("never puts a number in the heading beyond the iteration count", () => {
    const headings = [
      sheetHeading({
        ...base,
        face: "review",
        suggestion: item({
          feedbackFamily: "confident_voice",
          confidence: 0.83,
          score: 7,
        } as Partial<DocumentSuggestion>),
      }),
      sheetHeading({
        ...base,
        face: "review",
        suggestion: item({
          feedbackFamily: "rewrite_clarity",
          confidence: 0.91,
        } as Partial<DocumentSuggestion>),
      }),
    ];
    for (const { kicker, title } of headings) {
      const text = `${kicker ?? ""} ${title}`;
      expect(text).not.toMatch(/\d+(\.\d+)?\s*%/);
      expect(text).not.toMatch(/\d\.\d{2}/);
      expect(text).not.toMatch(/\b\d+\s*\/\s*\d+\b/);
      expect(text).not.toMatch(/score|verdict/i);
    }
  });
});
