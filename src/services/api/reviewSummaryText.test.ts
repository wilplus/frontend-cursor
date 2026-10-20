/*
STORY    As a speaker finishing the Feedback walk, I want the closing summary
         to show exactly the words the server saved, and to be skipped when
         there is nothing to say, so that I never see invented or empty text.
OUTCOME
  O1  The summary shows the words of the message the server stored.
  O2  If the server fails or stores only blank text, there is no summary.
PROVES   O1 -> "are the stored Lounge row's body, as the backend answers"
         O2 -> "are none when the backend fails or stores nothing to say"
WHY      Locked Feedback walk (lock 2026-10-12, sections 2.7 and 3).
*/
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
