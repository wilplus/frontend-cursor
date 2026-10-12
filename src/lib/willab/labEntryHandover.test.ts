import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetLabHandover,
  primeLabRoots,
  primeLabSetup,
  primedLabRoots,
  primedLabSetup,
} from "./labEntryHandover";

/* "Record Take N" starts without reading again (founder 2026-10-08, P2):
 * the page's latest reads, per project, for a short while. */

const SETUP = {
  topic: "Pitch",
  audience: "Board",
  targetLengthSeconds: 300,
  slides: [{ title: "One", body: "" }],
  presentationRef: "https://r2/deck.pdf",
};
const ROOTS = [{ slideIndex: 0, text: "Open with the one idea", type: "flagship" as const }];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(0);
  forgetLabHandover();
});
afterEach(() => vi.useRealTimers());

describe("the page's reads handed to the Lab", () => {
  it("hands over the setup and the roots of the same project only", () => {
    primeLabSetup("arc-1", SETUP);
    primeLabRoots("arc-1", ROOTS);
    expect(primedLabSetup("arc-1")).toEqual(SETUP);
    expect(primedLabRoots("arc-1")).toEqual(ROOTS);
    expect(primedLabSetup("arc-2")).toBeNull();
    expect(primedLabRoots("arc-2")).toBeNull();
    expect(primedLabRoots(null)).toBeNull();
  });
});
