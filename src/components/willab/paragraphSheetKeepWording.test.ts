/*
 * STORY    As a speaker, I want "Keep my words" to be remembered without ever
 *          blocking me, so that the same rewrite is not offered again until
 *          my words change.
 * OUTCOME
 *   O1  A keep_wording response is saved with the ids the accept path sends.
 *   O2  A failing save never throws: the walk goes on.
 * PROVES   O1 -> "saves keep_wording with the fields the accept path sends"
 *          O2 -> "a failing save never throws"
 * WHY      Q3 A (founder 2026-10-05, backend N48.2).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const save = vi.fn();
vi.mock("@/services/api/takeFeedback", async (orig) => ({
  ...(await orig<object>()),
  saveTakeFeedbackResponse: (...args: unknown[]) => save(...args),
}));

import { recordKeepWording } from "./ParagraphSheet";

const item = {
  id: "rw-1", takeSessionId: "take-1", feedbackFamily: "rewrite_clarity",
  candidateId: "cand-1", feedbackMembershipId: "mem-1", feedbackExposureId: "exp-1",
} as never;

describe("recordKeepWording", () => {
  beforeEach(() => save.mockReset());

  it("saves keep_wording with the fields the accept path sends", async () => {
    save.mockResolvedValue({ ok: true });
    await recordKeepWording(item);
    expect(save).toHaveBeenCalledWith({
      takeSessionId: "take-1", feedbackId: "rw-1", feedbackFamily: "rewrite_clarity",
      response: "keep_wording", candidateId: "cand-1",
      feedbackMembershipId: "mem-1", feedbackExposureId: "exp-1",
    });
  });

  it("a failing save never throws", async () => {
    save.mockRejectedValueOnce(new Error("network down"));
    await expect(recordKeepWording(item)).resolves.toBeUndefined();
    expect(save).toHaveBeenCalledTimes(1);
    // Here vitest fails a test whose mock still holds a rejected result at
    // its end, even one our code caught (seen 2026-10-19): let it go.
    save.mockReset();
  });
});
