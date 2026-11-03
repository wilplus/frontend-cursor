/*
STORY    As someone saying a voice note, I want its words to appear as I say
         them, so that I see at once that I am heard.
OUTCOME
  O1  Phrases show in the order they were said; a phrase stays lighter
      until its whole is heard, even when the provider finishes a later
      one first.
  O2  The voice is sent at the rate the provider's key names.
PROVES   O1 -> "keeps phrases in the order said and the unheard ones current"
         O2 -> "sends the voice at the provider's rate"
WHY      Backend N396 (amends N199 item 2): the words stream, well under a
         second behind the voice.
*/
import { describe, expect, it } from "vitest";
import { Phrases, toPcm16 } from "./liveStream";

describe("the streamed words of a note", () => {
  it("keeps phrases in the order said and the unheard ones current", () => {
    const p = new Phrases();
    p.delta("a", "so the ");
    p.delta("a", "opening");
    expect(p.read()).toEqual({ finished: [], current: "so the opening" });
    p.delta("b", "is short");
    p.completed("b", "is short.");
    // b is heard whole, but a is not yet: both stay current, in order.
    expect(p.read()).toEqual({ finished: [], current: "so the opening is short." });
    p.completed("a", "So the opening");
    expect(p.read()).toEqual({ finished: ["So the opening", "is short."], current: "" });
  });

  it("sends the voice at the provider's rate", () => {
    const pcm = toPcm16(new Float32Array(48_000).fill(0.5), 48_000, 24_000);
    expect(pcm.length).toBe(24_000);
    expect(pcm[0]).toBe(16383);
  });
});
