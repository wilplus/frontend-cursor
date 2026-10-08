/* -------------------------------------------------------------------------- */
/*  How the Ideal Text page loads (founder 2026-10-08, waiting-time fixes).    */
/* -------------------------------------------------------------------------- */
import { describe, expect, it, vi } from "vitest";
import type {
  IdealTextEnrichmentResult,
  IdealTextResult,
} from "@/services/api/idealText";
import {
  carryKeyMoments,
  carryShownFeedback,
  loadIdealTextEnrichment,
  mayCarry,
  revalidateHandoff,
  sameServedDocument,
  sdFromResult,
  type SingleIdealText,
} from "./idealTextLoad";
import { withSuggestionStatus } from "@/lib/willab/idealTextDecisions";
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

  it("applies the slow lane on its own when it answers first", async () => {
    const prompt = deferred<IdealTextEnrichmentResult>();
    const applied: SingleIdealText[] = [];
    const fetchLane = vi.fn(async (_a: string, _s: string, sections?: readonly string[]) =>
      sections?.includes("document_layers") ? layersLane : prompt.promise,
    );
    const done = loadIdealTextEnrichment("arc", core(), {
      isCurrent: () => true,
      apply: (m) => applied.push(m),
      setPending: () => {},
      refetch: () => {},
      fetchLane: fetchLane as never,
      settle: (async (_a: string, _s: string, e: Ready) => e) as never,
    });
    await vi.waitFor(() => expect(applied).toHaveLength(1));
    expect(applied[0].saved).toBe(true);
    expect(applied[0].coachMessage).toBeNull();
    prompt.resolve(journeyLane);
    await done;
    expect(applied.at(-1)?.coachMessage?.text).toBe("Well done.");
    expect(applied.at(-1)?.saved).toBe(true);
  });

  it("applies nothing once the page has moved on", async () => {
    const apply = vi.fn();
    const setPending = vi.fn();
    await loadIdealTextEnrichment("arc", core(), {
      isCurrent: () => false,
      apply,
      setPending,
      refetch: () => {},
      fetchLane: (async () => journeyLane) as never,
    });
    expect(apply).not.toHaveBeenCalled();
    expect(setPending).not.toHaveBeenCalled();
  });

  it("closes the slot and refetches when a lane says the snapshot moved", async () => {
    const pending: boolean[] = [];
    const refetch = vi.fn();
    const stale: IdealTextResult | IdealTextEnrichmentResult = {
      kind: "stale",
      currentDocumentSnapshotId: "snap-2",
    };
    await loadIdealTextEnrichment("arc", core(), {
      isCurrent: () => true,
      apply: () => {},
      setPending: (p) => pending.push(p),
      refetch,
      fetchLane: (async () => stale) as never,
    });
    expect(pending).toEqual([false]);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("asks for nothing without a snapshot", async () => {
    const fetchLane = vi.fn();
    await loadIdealTextEnrichment("arc", core({ documentSnapshotId: null }), {
      isCurrent: () => true,
      apply: () => {},
      setPending: () => {},
      refetch: () => {},
      fetchLane: fetchLane as never,
    });
    expect(fetchLane).not.toHaveBeenCalled();
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

  it("shows the item just decided with its new status, never as pending", () => {
    const decided = withSuggestionStatus(shown, "s1", "approved");
    const next = carryShownFeedback(decided, refetched, {}, true);
    expect(next.suggestions?.[0].status).toBe("approved");
  });

  it("lets each answered section replace what it owns", () => {
    const fresh = sdFromResult(core({ suggestions: [], coachMessage: null }));
    const afterJourney = carryShownFeedback(shown, fresh, { journey: "ready" }, true);
    expect(afterJourney.coachMessage).toBeNull();
    expect(afterJourney.suggestions).toEqual([bar]);
    const afterLayers = carryShownFeedback(shown, fresh, { document_layers: "ready" }, true);
    expect(afterLayers.suggestions).toEqual([]);
    expect(afterLayers.additions).toEqual([]);
    expect(afterLayers.coachMessage).toEqual(coach);
  });

  it("starts clean when it may not carry", () => {
    expect(carryShownFeedback(shown, refetched, {}, false)).toBe(refetched);
    expect(carryShownFeedback(null, refetched, {}, true)).toBe(refetched);
  });

  it("keeps the coach's key moments until the feedback section answers", () => {
    const moments = [{ snippetId: "k1" }] as never;
    const prev = { text: "t", keyMoments: moments, notes: null } as never;
    const next = { text: "t2", keyMoments: [], notes: null } as never;
    expect(carryKeyMoments(prev, next, {}, true).keyMoments).toBe(moments);
    expect(carryKeyMoments(prev, next, {}, true).text).toBe("t2");
    expect(carryKeyMoments(prev, next, { feedback: "ready" }, true)).toBe(next);
    expect(carryKeyMoments(prev, next, {}, false)).toBe(next);
  });

  it("carries only a refetch of the same Take", () => {
    expect(mayCarry(false, "take-1", "take-1")).toBe(true);
    // A first load, or a change of arc, starts clean.
    expect(mayCarry(true, "take-1", "take-1")).toBe(false);
    // Nothing shown yet.
    expect(mayCarry(false, undefined, "take-1")).toBe(false);
    // A new Take's feedback is about other words.
    expect(mayCarry(false, "take-1", "take-2")).toBe(false);
  });
});

describe("P1: a painted handover is revalidated behind it", () => {
  it("treats the same snapshot, version, text and bundle as the same document", () => {
    expect(sameServedDocument(core(), core())).toBe(true);
    expect(sameServedDocument(core(), core({ documentSnapshotId: "snap-2" }))).toBe(false);
    expect(sameServedDocument(core(), core({ version: 3 }))).toBe(false);
    expect(
      sameServedDocument(core(), core({ ideal: { text: "Other.", keyMoments: [], notes: null } as never })),
    ).toBe(false);
    expect(
      sameServedDocument(core(), core({ confidentMomentSummary: { items: [] } as never })),
    ).toBe(false);
  });

  it("refetches in place only when the fresh read differs", async () => {
    const refetch = vi.fn();
    await revalidateHandoff("arc", core(), { isCurrent: () => true, refetch }, async () => core());
    expect(refetch).not.toHaveBeenCalled();
    await revalidateHandoff("arc", core(), { isCurrent: () => true, refetch }, async () => core({ version: 3 }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("does nothing after the page moved on, or when the fresh read failed", async () => {
    const refetch = vi.fn();
    await revalidateHandoff("arc", core(), { isCurrent: () => false, refetch }, async () => core({ version: 3 }));
    await revalidateHandoff("arc", core(), { isCurrent: () => true, refetch }, async () => ({ kind: "error" }));
    expect(refetch).not.toHaveBeenCalled();
  });
});
