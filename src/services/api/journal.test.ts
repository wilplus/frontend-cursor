import { describe, expect, it } from "vitest";
import {
  isSafeBodyUrl,
} from "./journal";

/* -------------------------------------------------------------------------- */
/*  Body token parsing — the BODY TOKEN SPEC in journal.ts                     */
/* -------------------------------------------------------------------------- */

describe("isSafeBodyUrl", () => {

  it("rejects script schemes and protocol-relative URLs", () => {
    expect(isSafeBodyUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeBodyUrl("data:text/html,x")).toBe(false);
    expect(isSafeBodyUrl("vbscript:x")).toBe(false);
    expect(isSafeBodyUrl("//evil.test/a.png")).toBe(false);
    expect(isSafeBodyUrl("ftp://x/y")).toBe(false);
  });
});
