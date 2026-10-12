import { afterEach, describe, expect, it, vi } from "vitest";

import {
  draftTakeWord,
  fetchExercisePreference,
} from "./coachPanel";

describe("the calls", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("a dark route reads as null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ code: "NOT_FOUND" }) }));
    expect(await fetchExercisePreference("s", "m")).toBeNull();
    expect(await draftTakeWord("s")).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchExercisePreference("s", "m")).toBeNull();
  });

});
