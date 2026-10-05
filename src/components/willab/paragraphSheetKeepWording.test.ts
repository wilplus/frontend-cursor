/* Q3 A (founder 2026-10-05, backend N48.2): "Keep my words" on the paragraph
 * sheet records the owner's keep_wording response on the rewrite, so V3 does
 * not offer the same rewrite again until the Paragraph's words change. It is
 * fire-and-forget and never throws. */
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

  it("does nothing without a Take or a family", async () => {
    await recordKeepWording({ id: "x" } as never);
    expect(save).not.toHaveBeenCalled();
  });

  it("never throws when the save is refused", async () => {
    save.mockResolvedValue({ ok: false, status: 503 });
    let threw = false;
    try { await recordKeepWording(item); } catch { threw = true; }
    expect(threw).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
