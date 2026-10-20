/*
STORY    As a developer, I want processing updates read correctly however the network splits them, so that progress always reaches the speaker.
OUTCOME
  O1  An update split across several pieces arrives once, whole.
PROVES   O1 -> buffers frames split across arbitrary chunk boundaries
*/
import { describe, expect, it } from "vitest";
import { createSseFrameParser } from "./sse";

describe("createSseFrameParser", () => {

  it("buffers frames split across arbitrary chunk boundaries", () => {
    const parse = createSseFrameParser();
    expect(parse("event: sta")).toEqual([]);
    expect(parse("tus\ndata: {")).toEqual([]);
    expect(parse('"a":1}\n')).toEqual([]);
    expect(parse("\n")).toEqual([{ event: "status", data: '{"a":1}' }]);
  });
});
