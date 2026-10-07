/* The coach's walk, the pure half (founder 2026-09-30; P2-8). Pins: the queue
 * maps the backend's words and never invents a kind; the bubble counts
 * speakers with something waiting; the walk finds the next open moment. */
import { describe, expect, it } from "vitest";
import {
  afterJudged, afterNothingToAdd, mapMomentsQueue, nextOpenIndex,
  readSlideFor, speakersWaiting, stateWord, kindWord, answerWord,
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
  it("keeps the backend's order and words, drops what it cannot draw", () => {
    const out = mapMomentsQueue(RAW);
    expect(out.map((s) => s.pseudonym)).toEqual(["Quiet Heron", "Anonymous"]);
    const moments = out[0].takes[0].moments;
    expect(moments.map((m) => m.state)).toEqual(["judge_it", "answer_it", "answered"]);
  });

  it("never invents a kind before the rating", () => {
    const moments = mapMomentsQueue(RAW)[0].takes[0].moments;
    expect(moments[0].kind).toBeNull();
    expect(moments[1].kind).toBe("praise");
    expect(mapMomentsQueue([{ pseudonym: "x", takes: [{ session_id: "t", moments: [
      { snippet_id: "s", state: "judge_it", kind: "error" },
    ] }] }])[0].takes[0].moments[0].kind).toBe("error");
  });

  it("counts speakers with something waiting, never quality", () => {
    expect(speakersWaiting(mapMomentsQueue(RAW))).toBe(1);
    expect(mapMomentsQueue([])).toEqual([]);
  });

  it("a Take waiting for its text is listed and counted, never absent (A1)", () => {
    const out = mapMomentsQueue([{ pseudonym: "Calm Otter", waiting: 0, waiting_for_text: 1, takes: [
      { session_id: "t-9", take_index: 1, sent_at: "2026-10-01T09:00:00Z", waiting: 0,
        waiting_for_text: true, moments: [] },
    ] }]);
    expect(out[0].takes[0].waitingForText).toBe(true);
    expect(out[0].takes[0].moments).toEqual([]);
    expect(speakersWaiting(out)).toBe(1);
    expect(mapMomentsQueue(RAW)[0].takes[0].waitingForText).toBe(false);
  });
});

describe("the words", () => {
  it("every state, kind and answer is a word", () => {
    expect(stateWord("judge_it")).toBe("Judge it");
    expect(stateWord("nothing_to_add")).toBe("Nothing to add");
    expect(kindWord("rewrite")).toBe("Rewrite");
    expect(kindWord(null)).toBeNull();
    expect(answerWord("no")).toBe("Not confident");
    expect(answerWord("audio_unclear")).toBe("Audio unclear");
  });
});

describe("the walk's next step", () => {
  const moments = mapMomentsQueue(RAW)[0].takes[0].moments;
  it("finds the next open moment after the cursor, or none", () => {
    expect(nextOpenIndex(moments, null)).toBe(0);
    expect(nextOpenIndex(moments, 0)).toBe(1);
    expect(nextOpenIndex(moments, 1)).toBe(-1);
  });
  it("moves a moment on locally after the coach's own move", () => {
    expect(afterJudged(moments[0]).state).toBe("judged");
    expect(afterJudged(moments[1]).state).toBe("answer_it");
    expect(afterNothingToAdd(moments[1]).state).toBe("nothing_to_add");
  });
});

describe("the slide on Read (B5)", () => {
  const PDF = "https://media/deck.pdf";
  it("a take's own PDF: the page the moment began on", () => {
    expect(readSlideFor(PDF, { index: 3, title: "" })).toEqual({ presentationRef: PDF, pageIndex: 3 });
  });
  it("a deckless take: the default deck's slide, recognised by its title", () => {
    expect(readSlideFor(null, { index: 0, title: "Main premise" })).toEqual({ presentationRef: null, pageIndex: 0 });
    expect(readSlideFor(null, { index: 2, title: "Conclusion" })).toEqual({ presentationRef: null, pageIndex: 2 });
  });
  it("a typed deck with no picture behind it draws nothing, never the default artwork", () => {
    expect(readSlideFor(null, { index: 0, title: "Our Q3 numbers" })).toBeNull();
    expect(readSlideFor(null, { index: 5, title: "Main premise" })).toBeNull();
  });
  it("no slide, or a nonsense index, draws nothing", () => {
    expect(readSlideFor(PDF, null)).toBeNull();
    expect(readSlideFor(PDF, { index: -1, title: "" })).toBeNull();
    expect(readSlideFor(PDF, { index: 1.5, title: "" })).toBeNull();
  });
});

describe("the speaker's goal on the queue (D-CP-12)", () => {
  it("reads goal, or speaker_goal, trimmed; blank is none", () => {
    const [a, b, c] = mapMomentsQueue([
      { pseudonym: "A", waiting: 0, takes: [], goal: " Sound calm. " },
      { pseudonym: "B", waiting: 0, takes: [], speaker_goal: "Pitch well." },
      { pseudonym: "C", waiting: 0, takes: [], goal: "   " },
    ]);
    expect(a.goal).toBe("Sound calm.");
    expect(b.goal).toBe("Pitch well.");
    expect(c.goal).toBeNull();
  });
});

describe("the moment read's `heard` (D-CP-13)", () => {
  it("maps every kind by key, keeps the library's label, drops the malformed, null when absent", async () => {
    const { mapMomentRead } = await import("@/services/api/coachWalk");
    const read = mapMomentRead({
      passage: "p",
      heard: [
        { kind: "error", key: "rushing", label: "Rushing" },
        { kind: "cue", key: "landed_ending" },
        { kind: "reason", key: "weak_delivery_read" },
        { kind: "nothing", key: "nothing" },
        { kind: "score", key: "0.9" },
        { kind: "error" },
        "x",
      ],
    });
    expect(read?.heard).toEqual([
      { kind: "error", key: "rushing", label: "Rushing" },
      { kind: "cue", key: "landed_ending", label: null },
      { kind: "reason", key: "weak_delivery_read", label: null },
      { kind: "nothing", key: "nothing", label: null },
    ]);
    expect(mapMomentRead({ passage: "p" })?.heard).toBeNull();
  });
});
