/* -------------------------------------------------------------------------- */
/*  P1 (founder 2026-10-08): the Lounge's read paints the Ideal Text page for  */
/*  up to 30 s, revalidated behind it past the trusted 3 s; a press on the    */
/*  card starts that read early, once.                                        */
/* -------------------------------------------------------------------------- */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IDEAL_TEXT_DISPLAY_TRUSTED_MS,
  fetchIdealTextForOpen,
  invalidateIdealTextDisplay,
  primeIdealTextDisplay,
  type IdealTextResult,
} from "./idealText";

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
