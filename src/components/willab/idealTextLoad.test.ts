/*
STORY    As a speaker, I want my Ideal Text page to show the coach's note as
         soon as it arrives and keep the feedback shown while a new read
         loads, so that the page never goes blank or flickers.
OUTCOME
  O1  The coach's message is shown before the slower feedback arrives, and
      both are on the page once it does.
  O2  When the page re-reads, the feedback bars, style changes, additions
      and coach message stay while only the text has come back.
  O3  When the page stops asking for late marks, it says so: the reserved
      slot closes, so the lens never waits on it for good (WIL-76).
PROVES   O1 -> "applies the coach message before the slow lane answers"
         O2 -> "keeps what was shown while the core alone has landed"
         O3 -> "closes the slot when the asks stop with the marks still pending"
WHY      Founder 2026-10-08 (waiting-time fixes).
*/
import { describe, expect, it, vi } from "vitest";
import type {
  IdealTextEnrichmentResult,
} from "@/services/api/idealText";
import {
  carryShownFeedback,
  loadIdealTextEnrichment,
  sdFromResult,
  type SingleIdealText,
} from "./idealTextLoad";
import type { DocumentSuggestion } from "@/services/api/idealText";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

type Ready = Extract<IdealTextEnrichmentResult, { kind: "ready" }>;

function core(over: Partial<SingleIdealText> = {}): SingleIdealText {
  return {
    kind: "single",
    ideal: { text: "Core text.", keyMoments: [], notes: null },
    status: "unverified",
    version: 2,
    momentsUnlocked: false,
    explanationsAvailable: false,
    userEdited: false,
    priorEdit: null,
    canRecordTake: null,
    title: null,
    updatedAt: null,
    takeCount: 1,
    journeyNextStepsSeen: null,
    coachMessage: null,
    latestTakeSessionId: "take-1",
    pieces: null,
    suggestions: null,
    styleChanges: null,
    decisionHistory: null,
    saved: null,
    keyPoints: null,
    parts: null,
    additions: [],
    presentationRef: null,
    slideTitles: null,
    learningExposures: [],
    documentSnapshotId: "snap-1",
    documentSnapshotSha256: null,
    enrichmentSections: {},
    confidentMomentSummary: null,
    confidentMomentOwnerEdit: null,
    ...over,
  } as SingleIdealText;
}

const journeyLane: Ready = {
  kind: "ready",
  documentSnapshotId: "snap-1",
  sections: {
    journey: {
      status: "ready",
      retryable: false,
      data: { coach_message: { text: "Well done." } },
    },
  },
};
const layersLane: Ready = {
  kind: "ready",
  documentSnapshotId: "snap-1",
  sections: {
    document_layers: {
      status: "ready",
      retryable: false,
      data: { changes: [], is_saved: true },
    },
  },
};

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe("F1: the prompt lane paints on its own", () => {
  it("applies the coach message before the slow lane answers", async () => {
    const slow = deferred<IdealTextEnrichmentResult>();
    const applied: SingleIdealText[] = [];
    const pending: boolean[] = [];
    const fetchLane = vi.fn(async (_a: string, _s: string, sections?: readonly string[]) =>
      sections?.includes("document_layers") ? slow.promise : journeyLane,
    );
    const settle = vi.fn(async (_a: string, _s: string, e: Ready) => e);
    const done = loadIdealTextEnrichment("arc", core(), {
      isCurrent: () => true,
      apply: (m) => applied.push(m),
      setPending: (p) => pending.push(p),
      refetch: () => {},
      fetchLane: fetchLane as never,
      settle: settle as never,
    });
    await vi.waitFor(() => expect(applied).toHaveLength(1));
    expect(applied[0].coachMessage?.text).toBe("Well done.");
    expect(applied[0].suggestions).toBeNull();
    expect(applied[0].saved).toBeNull();
    expect(pending).toEqual([]);
    slow.resolve(layersLane);
    await done;
    const last = applied.at(-1)!;
    expect(last.coachMessage?.text).toBe("Well done.");
    expect(last.suggestions).toEqual([]);
    expect(last.saved).toBe(true);
    expect(last.enrichmentSections).toMatchObject({ journey: "ready", document_layers: "ready" });
    expect(pending.at(-1)).toBe(false);
    // The settle sees both lanes' sections, as before.
    expect(Object.keys(settle.mock.calls[0][2].sections).sort()).toEqual(["document_layers", "journey"]);
  });

  it("closes the slot when the asks stop with the marks still pending", async () => {
    const pendingLane: Ready = {
      kind: "ready",
      documentSnapshotId: "snap-1",
      sections: { document_layers: { status: "pending", retryable: true } },
    };
    const pending: boolean[] = [];
    const fetchLane = vi.fn(async (_a: string, _s: string, sections?: readonly string[]) =>
      sections?.includes("document_layers") ? pendingLane : journeyLane,
    );
    // The settle spent its budget: the marks still say "ask me again".
    const settle = vi.fn(async (_a: string, _s: string, e: Ready) => e);
    await loadIdealTextEnrichment("arc", core(), {
      isCurrent: () => true,
      apply: () => {},
      setPending: (p) => pending.push(p),
      refetch: () => {},
      fetchLane: fetchLane as never,
      settle: settle as never,
    });
    expect(pending).toEqual([true, false]);
  });
});

describe("F2: a refetch keeps the bars until the new enrichment replaces them", () => {
  const bar = { id: "s1", status: "pending" } as unknown as DocumentSuggestion;
  const style = { id: "st1", status: "pending" } as unknown as DocumentSuggestion;
  const coach = { text: "Well done.", videoUrl: null, takeIndex: 1, publishedAt: null };
  const shown = sdFromResult(
    core({
      suggestions: [bar],
      styleChanges: [style],
      coachMessage: coach,
      additions: [{ slideIndex: 1, text: "extra" }] as never,
      keyPoints: [] as never,
      decisionHistory: [] as never,
    }),
  );
  const refetched = sdFromResult(core({ version: 3 }));

  it("keeps what was shown while the core alone has landed", () => {
    const next = carryShownFeedback(shown, refetched, {}, true);
    expect(next.version).toBe(3);
    expect(next.suggestions).toEqual([bar]);
    expect(next.styleChanges).toEqual([style]);
    expect(next.coachMessage).toEqual(coach);
    expect(next.additions).toEqual(shown.additions);
  });
});
