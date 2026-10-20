import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "tok") }));

import { postReviewSummaryText } from "./reviewSummaryText";

const ASK = { takeSessionId: "t1", practice: null, helperWords: [], coachNote: null };

function answer(status: number, json: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(json), { status })));
}

afterEach(() => vi.unstubAllGlobals());

/** The walk's closing summary shows the words the backend stored; with
 *  none, the step is skipped (lock 2026-10-12, sections 2.7 and 3). */
describe("the closing summary's words", () => {
  it("are the stored Lounge row's body, as the backend answers", async () => {
    answer(200, { message: { client_id: "c1", kind: "cadence", body: "Your talk opened well.", metadata: { summary: true } } });
    expect(await postReviewSummaryText("a1", ASK)).toBe("Your talk opened well.");
  });

  it("are none when the backend fails or stores nothing to say", async () => {
    answer(500, { code: "V2_ERROR" });
    expect(await postReviewSummaryText("a1", ASK)).toBeNull();
    answer(200, { message: { body: "  " } });
    expect(await postReviewSummaryText("a1", ASK)).toBeNull();
  });
});
