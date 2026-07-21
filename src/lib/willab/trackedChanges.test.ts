import { describe, expect, it } from "vitest";
import {
  applyAcceptedReplacements,
  buildTrackedSegments,
  rebaseSuggestionsToSpan,
  resolveAdviceSpans,
  resolveTrackedSuggestions,
} from "./trackedChanges";
import type { DocumentSuggestion } from "@/services/api/idealText";

const sug = (o: Partial<DocumentSuggestion> & Pick<DocumentSuggestion, "start" | "end" | "quote">): DocumentSuggestion => ({
  id: o.id ?? `${o.start}:${o.end}`,
  start: o.start,
  end: o.end,
  quote: o.quote,
  kind: o.kind ?? "replace",
  proposedText: o.proposedText ?? "NEW",
  device: o.device ?? null,
  why: o.why ?? null,
  source: o.source ?? null,
  status: o.status ?? null,
  snippetId: o.snippetId ?? "s1",
  takeSessionId: o.takeSessionId ?? "t1",
});

const TEXT = "I think we can do this today.";

describe("resolveTrackedSuggestions (verify or drop)", () => {
  it("keeps a suggestion whose span still holds its exact quote", () => {
    const s = sug({ start: 2, end: 7, quote: "think" });
    expect(resolveTrackedSuggestions(TEXT, [s])).toEqual([s]);
  });

  it("DROPS a stale span rather than re-anchoring by search (FE-5)", () => {
    // The quote exists elsewhere in the text, but not at the given span —
    // re-finding it would strike the wrong words.
    const s = sug({ start: 0, end: 5, quote: "think" });
    expect(resolveTrackedSuggestions(TEXT, [s])).toEqual([]);
  });

  it("drops out-of-range spans and already-decided suggestions", () => {
    expect(
      resolveTrackedSuggestions(TEXT, [
        sug({ start: 900, end: 950, quote: "nope" }),
        sug({ start: 2, end: 7, quote: "think", status: "approved" }),
        sug({ start: 2, end: 7, quote: "think", status: "dismissed" }),
      ])
    ).toEqual([]);
  });

  it("never renders advice as a TEXT CHANGE (it draws a star, not a strike)", () => {
    const adv = sug({ start: 2, end: 7, quote: "think", kind: "advice", device: "pause" });
    expect(resolveTrackedSuggestions(TEXT, [adv])).toEqual([]);
    expect(resolveAdviceSpans(TEXT, [adv])).toEqual([adv]);
  });

  it("drops the overlapping loser, earlier start wins", () => {
    const a = sug({ id: "a", start: 2, end: 7, quote: "think" });
    const b = sug({ id: "b", start: 5, end: 13, quote: "nk we can" });
    const out = resolveTrackedSuggestions(TEXT, [b, a]);
    expect(out.map((s) => s.id)).toEqual(["a"]);
  });
});

describe("buildTrackedSegments", () => {
  it("splits into plain runs and suggestion runs in document order", () => {
    const s = sug({ start: 2, end: 7, quote: "think" });
    const segs = buildTrackedSegments(TEXT, [s]);
    expect(segs.map((x) => x.text)).toEqual(["I ", "think", " we can do this today."]);
    expect(segs[1].suggestion?.id).toBe(s.id);
    expect(segs.map((x) => x.text).join("")).toBe(TEXT);
  });

  it("hidden ids fall back to plain text", () => {
    const s = sug({ start: 2, end: 7, quote: "think" });
    const segs = buildTrackedSegments(TEXT, [s], new Set([s.id]));
    expect(segs.every((x) => !x.suggestion)).toBe(true);
  });

  it("returns the whole text when nothing resolves", () => {
    expect(buildTrackedSegments(TEXT, null)).toEqual([{ text: TEXT }]);
  });
});

describe("applyAcceptedReplacements", () => {
  it("applies right-to-left so earlier spans keep their offsets", () => {
    const a = sug({ id: "a", start: 2, end: 7, quote: "think", proposedText: "believe" });
    const b = sug({ id: "b", start: 23, end: 28, quote: "today", proposedText: "now" });
    const out = applyAcceptedReplacements(TEXT, [a, b], new Set(["a", "b"]));
    expect(out).toBe("I believe we can do this now.");
  });

  it("ignores unaccepted and non-replace suggestions", () => {
    const a = sug({ id: "a", start: 2, end: 7, quote: "think" });
    const b = sug({ id: "b", start: 23, end: 28, quote: "today", kind: "bold" });
    expect(applyAcceptedReplacements(TEXT, [a, b], new Set(["b"]))).toBe(TEXT);
  });
});

describe("resolveAdviceSpans + rebaseSuggestionsToSpan", () => {
  it("text changes win a collision; advice fills only what is left", () => {
    const rep = sug({ id: "r", start: 2, end: 7, quote: "think" });
    const adv = sug({
      id: "a",
      start: 0,
      end: 13,
      quote: "I think we can",
      kind: "advice",
      device: "pause",
    });
    // The advice sentence contains the replace — the replace must survive.
    expect(resolveTrackedSuggestions(TEXT, [rep, adv]).map((s) => s.id)).toEqual(["r"]);
    expect(resolveAdviceSpans(TEXT, [rep, adv]).map((s) => s.id)).toEqual([]);
  });

  it("advice without a device never resolves (no copy = no star)", () => {
    const adv = sug({ start: 2, end: 7, quote: "think", kind: "advice", device: null });
    expect(resolveAdviceSpans(TEXT, [adv])).toEqual([]);
  });

  it("rebase keeps only fully-contained spans, offset to paragraph-local", () => {
    const inside = sug({ id: "in", start: 12, end: 17, quote: "x" });
    const straddling = sug({ id: "out", start: 8, end: 14, quote: "y" });
    const out = rebaseSuggestionsToSpan([inside, straddling], { start: 10, end: 20 });
    expect(out?.map((s) => [s.id, s.start, s.end])).toEqual([["in", 2, 7]]);
  });
});
