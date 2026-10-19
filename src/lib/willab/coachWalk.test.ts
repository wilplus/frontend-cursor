/*
STORY    As a coach, I want the queue never to carry a moment's kind before I
         rate it, so that I never see the machine's guess first.
OUTCOME
  O1  Once I have rated a moment, the queue carries its kind; a moment the
      server sent no kind for has none.
  O2  An unrated moment (Judge it) carries no kind, whatever the server sent.
      Never-2: no coach sees the machine's guess before answering.
PROVES   O1 -> "carries the kind once the coach has rated the moment"
         O2 -> "KNOWN BREACH Never-2: ..." (it.fails until the mapper drops it)
WHY      Founder 2026-09-30, blind coach (P2-8).
*/
import { describe, expect, it } from "vitest";
import {
  mapMomentsQueue,
} from "./coachWalk";

const queueWith = (moments: unknown[]) =>
  mapMomentsQueue([
    { pseudonym: "Quiet Heron", takes: [{ session_id: "t-1", moments }] },
  ])[0].takes[0].moments;

describe("mapMomentsQueue keeps the coach blind", () => {

  it("carries the kind once the coach has rated the moment", () => {
    const moments = queueWith([
      { snippet_id: "s-1", state: "judge_it" },
      { snippet_id: "s-2", state: "answer_it", kind: "praise" },
      { snippet_id: "s-3", state: "answered", kind: "error" },
    ]);
    expect(moments.map((m) => m.snippetId)).toEqual(["s-1", "s-2", "s-3"]);
    expect(moments.map((m) => m.kind)).toEqual([null, "praise", "error"]);
  });

  it.fails(
    "KNOWN BREACH Never-2: an unrated moment keeps the kind the server sent (coachWalk.ts:70)",
    () => {
      // The backend withholds the kind today; the client does not enforce it,
      // so a server that sent one would put the machine's guess on screen.
      const [moment] = queueWith([
        { snippet_id: "s-1", state: "judge_it", kind: "error" },
      ]);
      expect(moment.snippetId).toBe("s-1");
      expect(moment.state).toBe("judge_it");
      expect(moment.kind).toBeNull();
    },
  );
});
