/* -------------------------------------------------------------------------- */
/*  P1 (founder 2026-10-08): the Lounge's read paints the Ideal Text page for  */
/*  up to 30 s, revalidated behind it past the trusted 3 s; a press on the    */
/*  card starts that read early, once.                                        */
/* -------------------------------------------------------------------------- */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
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
