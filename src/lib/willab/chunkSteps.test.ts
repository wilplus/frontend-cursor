import { describe, expect, it } from "vitest";

import {
  closesLock,
} from "./chunkSteps";

/* ── WHICH ANSWERS TAKE THE LOCK AWAY (founder 2026-09-24) ────────────────
 * "when there is an answer that no, not confident or not sure, do not give
 * the people option to lock it in ... and the same for audio unclear." Then,
 * on a draft that merely demoted Lock to Keep evolving: "no just don't show
 * that overlay; no keep evolving — after the rooting phrases close the
 * overlay in these cases."
 *
 * The distinction these pin is the one a collapsed yes/other answer cannot
 * express at all: "No" and "In-between" fall on opposite sides of it. */
describe("closesLock — No and Audio unclear end the ladder early", () => {
  it("Not sure ends the ladder too (founder lock 2026-09-30, B2; until then Q1 B kept its Lock)", () => {
    expect(closesLock("not_sure")).toBe(true);
  });
});
