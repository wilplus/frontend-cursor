/*
STORY    As a speaker, I want a suggestion whose words have moved to be dropped
         rather than painted on the wrong words, so that strike-throughs
         always mark what I said.
OUTCOME
  O1  A suggestion whose span still holds its quote is kept.
  O2  A stale span is dropped, never re-anchored by searching for the quote.
PROVES   O1 -> "KEEPS a span whose words are still there"
         O2 -> "DROPS a stale span rather than re-anchoring by search (FE-5)"
WHY      FE-5: re-finding a moved quote struck the wrong words.
*/
import { describe, expect, it } from "vitest";
import {
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
  takeIndex: o.takeIndex ?? null,
  blockKey: o.blockKey ?? null,
  why: o.why ?? null,
  source: o.source ?? null,
  status: o.status ?? null,
  snippetId: o.snippetId ?? "s1",
  takeSessionId: o.takeSessionId ?? "t1",
  visual: null,
  pendingBetterVersion: false,
  pendingCopy: null,
  cueKeys: [],
  praiseLine: null,
  rewriteMove: null,
  snippetAudioRef: null,
  startOffsetMs: null,
  durationMs: null,
  learningExposures: [],
});

const TEXT = "I think we can do this today.";

describe("resolveTrackedSuggestions (verify or drop)", () => {

  it("KEEPS a span whose words are still there", () => {
    const s = sug({ start: 2, end: 7, quote: "think" });
    expect(resolveTrackedSuggestions(TEXT, [s])).toEqual([s]);
  });

  it("DROPS a stale span rather than re-anchoring by search (FE-5)", () => {
    // The quote exists elsewhere in the text, but not at the given span —
    // re-finding it would strike the wrong words.
    const s = sug({ start: 0, end: 5, quote: "think" });
    expect(resolveTrackedSuggestions(TEXT, [s])).toEqual([]);
  });
});
