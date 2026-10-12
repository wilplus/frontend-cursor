// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const { shareTake } = vi.hoisted(() => ({ shareTake: vi.fn(async () => ({ ok: true as const, data: {} })) }));
vi.mock("@/services/api/communities", () => ({ shareTake }));

import { applyNextTakeShare, keepNextTakeShare, NEXT_SHARE_WORDS_VERSION } from "./nextTakeShare";

describe("sharing the next Take (lock 2026-10-12, section 5)", () => {
  beforeEach(() => {
    localStorage.clear();
    shareTake.mockClear();
  });

  it("shares the next uploaded Take as chosen, once, with the words the speaker saw", () => {
    keepNextTakeShare({ general: true, communityIds: ["c1"] });
    applyNextTakeShare("take-2");
    applyNextTakeShare("take-3");
    expect(shareTake).toHaveBeenCalledTimes(1);
    expect(shareTake).toHaveBeenCalledWith("take-2", {
      general: true,
      communityIds: ["c1"],
      none: false,
      shareWordsVersion: NEXT_SHARE_WORDS_VERSION,
    });
  });

  it("Only me shares nothing", () => {
    keepNextTakeShare({ general: true, communityIds: [] });
    keepNextTakeShare(null);
    applyNextTakeShare("take-2");
    expect(shareTake).not.toHaveBeenCalled();
  });
});
