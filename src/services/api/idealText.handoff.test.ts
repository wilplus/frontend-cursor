/*
STORY    As a speaker, I want my Ideal Text to open instantly from what the
         Lounge already loaded, and its feedback lanes fetched only once, so
         that opening is fast without showing stale text (record -> Ideal
         Text -> feedback).
OUTCOME
  O1  A handover up to 3 s old paints as-is with no request.
  O2  A handover between 3 s and 30 s old paints and is marked for
      revalidation behind it.
  O3  A handover past 30 s is not painted: the page reads fresh.
  O4  The two enrichment lanes started at settle are requested once, served
      to whichever surface asks, then consumed.
PROVES   O1 -> "paints a trusted handover as-is, without a request"
         O2 -> "paints a 3-30 s handover and asks for a revalidation"
         O3 -> "reads fresh past 30 s, never painting the old handover"
         O4 -> "serves the two lanes to whichever surface asks, without asking again"
WHY      P1 (founder 2026-10-08): the Lounge's read paints the page for up to
         30 s, revalidated behind it past the trusted 3 s.
*/
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IDEAL_TEXT_DISPLAY_HANDOFF_MS,
  IDEAL_TEXT_DISPLAY_TRUSTED_MS,
  fetchIdealTextEnrichment,
  fetchIdealTextForOpen,
  invalidateIdealTextDisplay,
  primeIdealTextDisplay,
  primeIdealTextEnrichmentLanes,
  type IdealTextResult,
} from "./idealText";
import { PROMPT_LANE, SLOW_LANE } from "@/lib/willab/enrichmentSettle";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

const doc = (text: string): IdealTextResult => ({
  kind: "ready",
  ideal: { text, keyMoments: [], notes: null } as never,
});

afterEach(() => {
  invalidateIdealTextDisplay("arc");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function clockAt(start: number) {
  let now = start;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  return (ms: number) => { now += ms; };
}

describe("the Ideal Text page's first read", () => {
  it("paints a trusted handover as-is, without a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const advance = clockAt(1_000_000);
    primeIdealTextDisplay("arc", doc("Primed."));
    advance(IDEAL_TEXT_DISPLAY_TRUSTED_MS);
    const open = await fetchIdealTextForOpen("arc");
    expect(open.revalidate).toBe(false);
    expect(open.result.kind === "ready" && open.result.ideal.text).toBe("Primed.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("paints a 3-30 s handover and asks for a revalidation", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const advance = clockAt(1_000_000);
    primeIdealTextDisplay("arc", doc("Primed."));
    advance(IDEAL_TEXT_DISPLAY_TRUSTED_MS + 1);
    const open = await fetchIdealTextForOpen("arc");
    expect(open.revalidate).toBe(true);
    expect(open.result.kind === "ready" && open.result.ideal.text).toBe("Primed.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads fresh past 30 s, never painting the old handover", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500, json: async () => null }));
    vi.stubGlobal("fetch", fetchMock);
    const advance = clockAt(1_000_000);
    primeIdealTextDisplay("arc", doc("Primed."));
    advance(IDEAL_TEXT_DISPLAY_HANDOFF_MS + 1);
    const open = await fetchIdealTextForOpen("arc");
    expect(fetchMock).toHaveBeenCalled();
    expect(open.revalidate).toBe(false);
    expect(open.result.kind).toBe("error");
  });
});

describe("the enrichment started at settle", () => {
  it("serves the two lanes to whichever surface asks, without asking again", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const asked = new URL(url, "http://x").searchParams.get("sections") ?? "";
      const sections = Object.fromEntries(
        asked.split(",").map((name) => [name, { status: "ready", data: { name } }]),
      );
      return { ok: true, status: 200, json: async () => ({ document_snapshot_id: "snap", sections }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    primeIdealTextEnrichmentLanes("arc", "snap");
    primeIdealTextEnrichmentLanes("arc", "snap");
    // The in-Lab readout asks for everything at once: both lanes, as one.
    const all = await fetchIdealTextEnrichment("arc", "snap");
    expect(all.kind === "ready" && Object.keys(all.sections).sort()).toEqual(
      [...PROMPT_LANE, ...SLOW_LANE].sort(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Consumed: the next ask, lane by lane or whole, is a fresh read.
    await fetchIdealTextEnrichment("arc", "snap", SLOW_LANE);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
