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
  O5  The coach's link starts the page's read, and the marks' lane, as /chat
      opens; the page opens on them without asking again, and the coach's
      own lane is still read for the Take the link names.
PROVES   O1 -> "paints a trusted handover as-is, without a request"
         O2 -> "paints a 3-30 s handover and asks for a revalidation"
         O3 -> "reads fresh past 30 s, never painting the old handover"
         O4 -> "serves the two lanes to whichever surface asks, without asking again"
         O5 -> "the coach's link reads the page as /chat opens, and the page opens on that read"
WHY      P1 (founder 2026-10-08): the Lounge's read paints the page for up to
         30 s, revalidated behind it past the trusted 3 s. Loading time
         (2026-11-05): the coach's link waited for the Lounge to mount first.
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
  warmIdealTextLink,
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

describe("the coach's link", () => {
  it("the coach's link reads the page as /chat opens, and the page opens on that read", async () => {
    const asked: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      const u = new URL(url, "http://x");
      asked.push(`${u.pathname} ${u.searchParams.get("sections") ?? ""} ${u.searchParams.get("take") ?? ""}`.trim());
      if (u.pathname.endsWith("/ideal-text/core")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "unverified",
            text: "The coach read this.",
            version: 3,
            document_snapshot_id: "snap",
            document_snapshot_sha256: "a".repeat(64),
            pieces: [{ piece_key: 0, part_id: "part-1", text: "The coach read this.", slide_index: 0 }],
            parts: null,
          }),
        };
      }
      const sections = Object.fromEntries(
        (u.searchParams.get("sections") ?? "").split(",").map((name) => [name, { status: "ready", data: { name } }]),
      );
      return { ok: true, status: 200, json: async () => ({ document_snapshot_id: "snap", sections }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    warmIdealTextLink("arc", "take-7"); // /chat?lens=arc&take=take-7 opens
    const open = await fetchIdealTextForOpen("arc"); // the page mounts
    expect(open.result.kind === "single" && open.result.ideal.text).toBe("The coach read this.");
    await vi.waitFor(() => expect(asked).toHaveLength(2));
    // The page asks its two lanes: the marks' lane was already on its way;
    // the coach's lane is read for the Take the link names.
    await fetchIdealTextEnrichment("arc", "snap", SLOW_LANE);
    await fetchIdealTextEnrichment("arc", "snap", PROMPT_LANE, "take-7");
    expect(asked).toEqual([
      "/api/v2/explore/arc/arc/ideal-text/core",
      `/api/v2/explore/arc/arc/ideal-text/enrichment ${SLOW_LANE.join(",")}`,
      `/api/v2/explore/arc/arc/ideal-text/enrichment ${PROMPT_LANE.join(",")} take-7`,
    ]);
  });
});
