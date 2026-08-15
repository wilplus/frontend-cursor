import { describe, expect, it } from "vitest";

import {
  CLARITY_WHY,
  EMPHASIS_WHY,
  WHY_COPY,
  whyLine,
} from "@/lib/willab/trackedChangeWhy";
import { mapDocumentSuggestions } from "@/services/api/idealText";
import type { DocumentSuggestion } from "@/services/api/idealText";

/* -------------------------------------------------------------------------- */
/*  THE REASON LINE (founder copy, 2026-08-07)                                 */
/*                                                                            */
/*  LIVE LOOP: user-facing copy needs founder sign-off, so the strings are     */
/*  pinned here. Editing one has to be a deliberate act with this test in the  */
/*  diff, not a passing tweak — which is the whole point of the fence.         */
/*                                                                            */
/*  The BE sends a KEY and the FE holds the copy. That is what makes the fence */
/*  enforceable at all: a model-authored sentence arriving on `why` cannot     */
/*  render, because nothing renders except what is written below.             */
/* -------------------------------------------------------------------------- */

const sug = (o: Partial<DocumentSuggestion> = {}): DocumentSuggestion => ({
  id: o.id ?? "s1",
  start: 0,
  end: 5,
  quote: "hello",
  kind: o.kind ?? "replace",
  proposedText: "hi",
  device: null,
  takeIndex: null,
  blockKey: null,
  why: o.why ?? null,
  source: o.source ?? "polish",
  status: null,
  snippetId: "s1",
  takeSessionId: "t1",
  visual: null,
  pendingBetterVersion: false,
  pendingCopy: null,
  cueKeys: [],
  snippetAudioRef: null,
  startOffsetMs: null,
  durationMs: null,
});

describe("the founder copy is exactly what was signed off", () => {
  it("carries the five clarity lines, verbatim", () => {
    expect([...CLARITY_WHY]).toEqual([
      "This makes your message clearer.",
      "This sounds smoother and easier to follow.",
      "This helps your words flow better.",
      "This makes your point easier to understand.",
      "This gives your message a cleaner finish.",
    ]);
  });

  it("carries the five emphasis lines, verbatim", () => {
    expect([...EMPHASIS_WHY]).toEqual([
      "This helps your main point stand out.",
      "This makes the key idea clearer.",
      "This gives your message more focus.",
      "This helps people notice what matters most.",
      "This makes your core message stronger.",
    ]);
  });

  it("keeps the two sets disjoint", () => {
    // They are split on what the change DOES to the text. A sentence that
    // could sit in either set would mean the split is not real.
    const overlap = CLARITY_WHY.filter((c) =>
      (EMPHASIS_WHY as readonly string[]).includes(c)
    );
    expect(overlap).toEqual([]);
  });
});

describe("whyLine picks from the right set", () => {
  it("clarity renders clarity copy", () => {
    const line = whyLine(sug({ why: "clarity" }));
    expect(CLARITY_WHY).toContain(line);
  });

  it("emphasis renders emphasis copy", () => {
    const line = whyLine(sug({ why: "emphasis", kind: "bold" }));
    expect(EMPHASIS_WHY).toContain(line);
  });

  it("a cross-take key still renders the COMPARISON copy", () => {
    // The four SwapWhy keys compare two takes. They must not be rerouted
    // through the new sets, and the new keys must not reach WHY_COPY.
    expect(whyLine(sug({ why: "energy", source: "prior_take" }))).toBe(
      WHY_COPY.energy
    );
  });

  it("comparison copy never lands on a non-comparison lane", () => {
    // The bug this whole change exists to avoid: "This take simply landed
    // better overall." next to a polish star, describing a second take that
    // does not exist in that lane.
    const line = whyLine(sug({ why: "clarity" }));
    expect(Object.values(WHY_COPY)).not.toContain(line);
  });

  it("no key renders no line — never a fallback sentence", () => {
    expect(whyLine(sug({ why: null }))).toBeNull();
  });
});

describe("the variant is stable, not random", () => {
  it("the same change gives the same sentence every time", () => {
    // A random pick would re-roll on every render and reload. A reason line
    // that rewords itself while you look at it reads as the system changing
    // its mind about the advice.
    const s = sug({ id: "abc-123", why: "clarity" });
    const first = whyLine(s);
    for (let i = 0; i < 50; i += 1) expect(whyLine(s)).toBe(first);
  });

  it("different changes spread across the set", () => {
    // The variants exist so three changes on one document do not read as
    // three copies of one sentence. If every id mapped to one bucket the
    // rotation would be decorative.
    const seen = new Set(
      Array.from({ length: 40 }, (_, i) =>
        whyLine(sug({ id: `snippet-${i}`, why: "clarity" }))
      )
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it("indexes stay inside the set for adversarial ids", () => {
    for (const id of ["", "x", "\u{1F600}", "z".repeat(500)]) {
      expect(CLARITY_WHY).toContain(whyLine(sug({ id, why: "clarity" })));
    }
  });
});

describe("the wire vocabulary stays closed", () => {
  const raw = (why_key: unknown) => [
    {
      id: "c1",
      kind: "replace",
      source: "polish",
      span: { start: 0, end: 5 },
      quote: "hello",
      proposed_text: "hi",
      snippet_id: "s1",
      take_session_id: "t1",
      why_key,
    },
  ];

  it("accepts the two new keys", () => {
    for (const key of ["clarity", "emphasis"]) {
      expect(mapDocumentSuggestions(raw(key))?.[0].why).toBe(key);
    }
  });

  it("still accepts the four comparison keys", () => {
    for (const key of ["energy", "steadiness", "coverage", "overall"]) {
      expect(mapDocumentSuggestions(raw(key))?.[0].why).toBe(key);
    }
  });

  it("model free text resolves to NO line, never to itself", () => {
    // `why` on the BE is the model's own sentence. It arrives on the payload
    // and must die here — un-signed-off prose reaching a student is the
    // LIVE LOOP breach this validation exists to stop.
    const free = "Tighter, and it lands better because you sound surer.";
    expect(mapDocumentSuggestions(raw(free))?.[0].why).toBeNull();
    // And null even if it somehow got past the mapper — the resolver is the
    // last gate, so it must not return the key it was handed.
    expect(whyLine(sug({ why: free as never }))).toBeNull();
  });

  it("a suggestion carrying no key at all is still rendered", () => {
    // The reason line is optional; the lead line carries the message. A
    // missing key must not drop the whole suggestion.
    const out = mapDocumentSuggestions(raw(undefined));
    expect(out).toHaveLength(1);
    expect(out?.[0].why).toBeNull();
  });
});
