import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchTakeBubbles, mapTakeBubbles } from "./coachBubbles";

describe("Phase 0c · the Take bubbles", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("read a bubble as a Take and who sent it, nothing about its quality", () => {
    const out = mapTakeBubbles({ bubbles: [
      { session_id: "t1", take_index: 2, sent_at: "2026-10-01T10:00:00Z", pseudonym: "Playful Octopus",
        name: "Ada", waiting_for_text: false, first_snippet_id: "s1", score: 0.9 },
      { session_id: "t2", take_index: null, sent_at: "", pseudonym: "Quiet Fox", waiting_for_text: true, first_snippet_id: null },
    ] });
    expect(out[0]).toEqual({ sessionId: "t1", takeIndex: 2, sentAt: "2026-10-01T10:00:00Z", pseudonym: "Playful Octopus",
      name: "Ada", waitingForText: false, firstSnippetId: "s1" });
    expect(out[1].name).toBeNull();
    expect(mapTakeBubbles(null)).toEqual([]);
  });

  it("a dark route reads as null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    expect(await fetchTakeBubbles()).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ bubbles: [] }) }));
    expect(await fetchTakeBubbles()).toEqual([]);
  });

  it("the BFF route goes through the one relay", () => {
    const source = readFileSync("src/app/api/v2/coach/take-bubbles/route.ts", "utf8");
    expect(source).toMatch(/relayJson\(/);
    expect(source).not.toMatch(/\bfetch\(/);
  });
});
