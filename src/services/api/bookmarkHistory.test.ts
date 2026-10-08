import { describe, expect, it, vi } from "vitest";

const bff = vi.fn();
vi.mock("@/lib/api/bffFetch", () => ({ bffFetch: (...a: unknown[]) => bff(...a) }));

import {
  HISTORIES_PER_REQUEST,
  fetchParagraphHistories,
  mapOwnerAnswers,
  mapParagraphHistory,
} from "./bookmarkHistory";

describe("the batched history read (F5)", () => {
  const one = { slide_index: 2, versions: [], helper_words: [], practice: [] };

  it("asks once for every part and maps each body like the single read", async () => {
    bff.mockResolvedValueOnce({
      kind: "response", ok: true, status: 200, body: { histories: { "a b": one } },
    });
    const read = await fetchParagraphHistories("arc/1", ["a b", "c"]);
    expect(bff).toHaveBeenCalledWith(
      "/api/v2/explore/arc/arc%2F1/part-histories?part_ids=a%20b,c",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(read.kind).toBe("ok");
    if (read.kind !== "ok") return;
    expect(read.histories.get("a b")).toEqual(mapParagraphHistory(one));
    expect(read.histories.has("c")).toBe(false);
  });

  it("splits a long deck into a few requests and joins them", async () => {
    bff.mockReset();
    bff.mockResolvedValue({ kind: "response", ok: true, status: 200, body: { histories: { p0: one } } });
    const ids = Array.from({ length: HISTORIES_PER_REQUEST + 1 }, (_, i) => `p${i}`);
    const read = await fetchParagraphHistories("arc", ids);
    expect(bff).toHaveBeenCalledTimes(2);
    expect(read.kind).toBe("ok");
  });

  it("says absent on a 404 and failed on anything else", async () => {
    bff.mockResolvedValueOnce({ kind: "response", ok: false, status: 404, body: null });
    expect(await fetchParagraphHistories("arc", ["a"])).toEqual({ kind: "absent" });
    bff.mockResolvedValueOnce({ kind: "response", ok: false, status: 500, body: null });
    expect(await fetchParagraphHistories("arc", ["a"])).toEqual({ kind: "failed" });
    bff.mockResolvedValueOnce({ kind: "network" });
    expect(await fetchParagraphHistories("arc", ["a"])).toEqual({ kind: "failed" });
  });
});

describe("bookmark history payloads", () => {
  it("maps the history, keeping unknown Takes unknown", () => {
    const h = mapParagraphHistory({
      slide_index: 1,
      versions: [
        { version: 1, take_index: 2, paragraphs: ["A."], at: "t" },
        { version: 2, take_index: null, paragraphs: ["B.", 3] },
      ],
      helper_words: [{ phrases: ["a", null], at: "x" }],
      practice: [{ before: "o", after: "n", at: null }],
    });
    expect(h?.versions).toEqual([
      { takeIndex: 2, paragraphs: ["A."], at: "t" },
      { takeIndex: null, paragraphs: ["B."], at: null },
    ]);
    expect(h?.helperWords).toEqual([{ phrases: ["a"], at: "x" }]);
    expect(h?.practice).toEqual([{ before: "o", after: "n", at: null }]);
    expect(mapParagraphHistory({})).toBeNull();
  });

  it("keeps an accepted correction apart from the Takes (N48.1)", () => {
    const h = mapParagraphHistory({
      slide_index: 0,
      versions: [
        { kind: "take", version: 1, take_index: 1, paragraphs: ["A."], at: "t1" },
        {
          kind: "accepted_correction",
          version: null,
          take_index: null,
          paragraphs: ["A, corrected."],
          at: "t2",
        },
        { kind: "take", version: 2, take_index: 2, paragraphs: ["A two."], at: "t3" },
      ],
      helper_words: [],
      practice: [],
    });
    expect(h?.versions).toEqual([
      { takeIndex: 1, paragraphs: ["A."], at: "t1" },
      { takeIndex: 2, paragraphs: ["A two."], at: "t3" },
    ]);
    expect(h?.corrections).toEqual([{ paragraphs: ["A, corrected."], at: "t2" }]);
  });

  it("maps only complete answers", () => {
    expect(
      mapOwnerAnswers({
        answers: [
          { feedback_id: "f1", response: "yes" },
          { feedback_id: "f2" },
          "junk",
        ],
      }),
    ).toEqual([{ feedbackId: "f1", response: "yes" }]);
    expect(mapOwnerAnswers(null)).toEqual([]);
  });
});
