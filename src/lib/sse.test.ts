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
