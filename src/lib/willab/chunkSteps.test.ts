/*
 * STORY    As a speaker, I want No, Not sure and Audio unclear to take away
 *          Lock, so that I am not asked to lock in something I am unsure of.
 * OUTCOME
 *   O1  No, Not sure and Audio unclear close the lock step.
 *   O2  Yes and In-between keep it.
 * PROVES   O1 -> "No, Not sure and Audio unclear end the ladder early"
 *          O2 -> "Yes and In-between keep their Lock"
 * WHY      Founder 2026-09-24 and lock 2026-09-30 (B2).
 */
import { describe, expect, it } from "vitest";

import { closesLock } from "./chunkSteps";

describe("closesLock", () => {
  it("No, Not sure and Audio unclear end the ladder early", () => {
    expect(closesLock("no")).toBe(true);
    expect(closesLock("not_sure")).toBe(true);
    expect(closesLock("audio_unclear")).toBe(true);
  });

  it("Yes and In-between keep their Lock", () => {
    expect(closesLock("yes")).toBe(false);
    expect(closesLock("in_between")).toBe(false);
  });
});
