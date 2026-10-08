/* -------------------------------------------------------------------------- */
/*  P1 (founder 2026-10-08): the Lounge's read paints the Ideal Text page for  */
/*  up to 30 s, revalidated behind it past the trusted 3 s; a press on the    */
/*  card starts that read early, once.                                        */
/* -------------------------------------------------------------------------- */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IDEAL_TEXT_DISPLAY_HANDOFF_MS,
  IDEAL_TEXT_DISPLAY_TRUSTED_MS,
  fetchIdealTextForDisplay,
  fetchIdealTextForOpen,
  invalidateIdealTextDisplay,
  prefetchIdealTextDisplay,
  primeIdealTextDisplay,
  type IdealTextResult,
} from "./idealText";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

const doc = (text: string): IdealTextResult => ({
  kind: "ready",
  ideal: { text, keyMoments: [], notes: null } as never,
});
const coreBody = {
  status: "unverified",
  text: "Fresh text.",
  version: 3,
  document_snapshot_id: "snap-3",
  document_snapshot_sha256: "a".repeat(64),
};
const response = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

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

  it("paints an older handover up to 30 s and asks for a revalidation", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const advance = clockAt(1_000_000);
    primeIdealTextDisplay("arc", doc("Primed."));
    advance(IDEAL_TEXT_DISPLAY_HANDOFF_MS);
    const open = await fetchIdealTextForOpen("arc");
    expect(open.revalidate).toBe(true);
    expect(open.result.kind === "ready" && open.result.ideal.text).toBe("Primed.");
  });

  it("reads fresh past 30 s, and uses a handover once", async () => {
    const fetchMock = vi.fn(async () => response(coreBody));
    vi.stubGlobal("fetch", fetchMock);
    const advance = clockAt(1_000_000);
    primeIdealTextDisplay("arc", doc("Primed."));
    advance(IDEAL_TEXT_DISPLAY_HANDOFF_MS + 1);
    const late = await fetchIdealTextForOpen("arc");
    expect(late.revalidate).toBe(false);
    expect(late.result.kind).toBe("single");
    primeIdealTextDisplay("arc", doc("Primed."));
    await fetchIdealTextForOpen("arc");
    await fetchIdealTextForOpen("arc");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("the read-aloud surface keeps the trusted 3 s window", async () => {
    const fetchMock = vi.fn(async () => response(coreBody));
    vi.stubGlobal("fetch", fetchMock);
    const advance = clockAt(1_000_000);
    primeIdealTextDisplay("arc", doc("Primed."));
    advance(IDEAL_TEXT_DISPLAY_TRUSTED_MS + 1);
    const r = await fetchIdealTextForDisplay("arc");
    expect(r.kind).toBe("single");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("a press on the card starts the read", () => {
  it("is awaited by the opening screen instead of asking twice", async () => {
    let answer: (v: unknown) => void = () => {};
    const fetchMock = vi.fn(() => new Promise((r) => { answer = r; }));
    vi.stubGlobal("fetch", fetchMock);
    prefetchIdealTextDisplay("arc");
    const opening = fetchIdealTextForOpen("arc");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    answer(response(coreBody));
    const open = await opening;
    expect(open.revalidate).toBe(false);
    expect(open.result.kind === "single" && open.result.ideal.text).toBe("Fresh text.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is deduped while a read is in flight or still trusted", async () => {
    const fetchMock = vi.fn(async () => response(coreBody));
    vi.stubGlobal("fetch", fetchMock);
    const advance = clockAt(1_000_000);
    prefetchIdealTextDisplay("arc");
    prefetchIdealTextDisplay("arc");
    primeIdealTextDisplay("arc", doc("Primed."));
    advance(1_000);
    prefetchIdealTextDisplay("arc");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    advance(IDEAL_TEXT_DISPLAY_TRUSTED_MS);
    prefetchIdealTextDisplay("arc");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("falls back to a fresh read when the press's read failed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => null })
      .mockResolvedValueOnce(response(coreBody));
    vi.stubGlobal("fetch", fetchMock);
    prefetchIdealTextDisplay("arc");
    const open = await fetchIdealTextForOpen("arc");
    expect(open.result.kind).toBe("single");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
