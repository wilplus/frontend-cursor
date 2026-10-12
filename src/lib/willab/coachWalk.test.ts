/* The coach's walk, the pure half (founder 2026-09-30; P2-8). Pins: the queue
 * maps the backend's words and never invents a kind; the bubble counts
 * speakers with something waiting; the walk finds the next open moment. */
import { describe, expect, it } from "vitest";
import {
  mapMomentsQueue,
} from "./coachWalk";

const RAW = [
  {
    pseudonym: "Quiet Heron", waiting: 2,
    takes: [{
      session_id: "t-1", take_index: 2, sent_at: "2026-09-30T10:00:00Z", waiting: 2,
      moments: [
        { snippet_id: "s-1", state: "judge_it" },
        { snippet_id: "s-2", state: "answer_it", kind: "praise" },
        { snippet_id: "s-3", state: "answered", kind: "error" },
        { snippet_id: "s-4", state: "score", kind: "error" },
      ],
    }],
  },
  { pseudonym: "", waiting: 0, takes: [] },
  "junk",
];

describe("mapMomentsQueue", () => {

  it("never invents a kind before the rating", () => {
    const moments = mapMomentsQueue(RAW)[0].takes[0].moments;
    expect(moments[0].kind).toBeNull();
    expect(moments[1].kind).toBe("praise");
    expect(mapMomentsQueue([{ pseudonym: "x", takes: [{ session_id: "t", moments: [
      { snippet_id: "s", state: "judge_it", kind: "error" },
    ] }] }])[0].takes[0].moments[0].kind).toBe("error");
  });
});
