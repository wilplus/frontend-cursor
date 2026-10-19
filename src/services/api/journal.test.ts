/*
STORY    As a reader of the journal, I want links in posts limited to safe web
         addresses, so that a post can never run a script on me.
OUTCOME
  O1  javascript:, data:, vbscript:, protocol-relative //host and ftp links
      are refused.
  O2  https and http links and site paths are accepted, so images and files
      in a post still show.
PROVES   O1 -> "rejects script schemes and protocol-relative URLs"
         O2 -> "accepts web addresses and site paths"
*/
import { describe, expect, it } from "vitest";
import { isSafeBodyUrl } from "./journal";

describe("isSafeBodyUrl", () => {

  it("rejects script schemes and protocol-relative URLs", () => {
    expect(isSafeBodyUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeBodyUrl("data:text/html,x")).toBe(false);
    expect(isSafeBodyUrl("vbscript:x")).toBe(false);
    expect(isSafeBodyUrl("//evil.test/a.png")).toBe(false);
    expect(isSafeBodyUrl("ftp://x/y")).toBe(false);
  });

  it("accepts web addresses and site paths", () => {
    expect(isSafeBodyUrl("https://cdn.willpowerlab.com/a.png")).toBe(true);
    expect(isSafeBodyUrl("http://example.com/b.pdf")).toBe(true);
    expect(isSafeBodyUrl("/journal/c.png")).toBe(true);
  });
});
