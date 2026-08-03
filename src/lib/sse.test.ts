import { describe, expect, it } from "vitest";
import { createSseFrameParser } from "./sse";

describe("createSseFrameParser", () => {
  it("parses a complete single frame", () => {
    const parse = createSseFrameParser();
    expect(parse('event: status\ndata: {"state":"processing"}\n\n')).toEqual([
      { event: "status", data: '{"state":"processing"}' },
    ]);
  });

  it("buffers frames split across arbitrary chunk boundaries", () => {
    const parse = createSseFrameParser();
    expect(parse("event: sta")).toEqual([]);
    expect(parse("tus\ndata: {")).toEqual([]);
    expect(parse('"a":1}\n')).toEqual([]);
    expect(parse("\n")).toEqual([{ event: "status", data: '{"a":1}' }]);
  });

  it("returns multiple frames from one chunk, in order", () => {
    const parse = createSseFrameParser();
    expect(parse("data: one\n\ndata: two\n\n")).toEqual([
      { event: "message", data: "one" },
      { event: "message", data: "two" },
    ]);
  });

  it("joins multi-data lines with newlines (SSE spec)", () => {
    const parse = createSseFrameParser();
    expect(parse("data: line1\ndata: line2\n\n")).toEqual([
      { event: "message", data: "line1\nline2" },
    ]);
  });

  it("ignores comment heartbeats and unknown fields", () => {
    const parse = createSseFrameParser();
    expect(parse(": ping\n\n")).toEqual([]);
    expect(parse(": connected\nretry: 3000\nid: 7\ndata: x\n\n")).toEqual([
      { event: "message", data: "x" },
    ]);
  });

  it("emits nothing for a frame with no data line", () => {
    const parse = createSseFrameParser();
    expect(parse("event: status\n\n")).toEqual([]);
  });

  it("strips exactly one leading space from field values", () => {
    const parse = createSseFrameParser();
    expect(parse("data:  spaced\n\n")).toEqual([
      { event: "message", data: " spaced" },
    ]);
    expect(parse("data:tight\n\n")).toEqual([
      { event: "message", data: "tight" },
    ]);
  });

  it("handles CRLF line endings, including a chunk boundary mid-CRLF", () => {
    const parse = createSseFrameParser();
    expect(parse("data: a\r\n\r\n")).toEqual([{ event: "message", data: "a" }]);
    // Boundary lands between the \r and the \n of a CRLF pair.
    expect(parse("data: b\r")).toEqual([]);
    expect(parse("\n\r\n")).toEqual([{ event: "message", data: "b" }]);
  });
});
