/*
STORY    As a speaker, I want "Record Take N" to start straight away with the
         page's latest setup, for that project only and only for a short
         while, so that the next Take starts fast and never on another
         project's or a stale setup.
OUTCOME
  O1  The same project gets the setup and helper words the page just read;
      another project (or none) gets null.
  O2  Once the short window has passed, the Lab gets null and reads again.
PROVES   O1 -> "hands over the setup and the roots of the same project only"
         O2 -> "hands over nothing once the window has passed"
WHY      Founder 2026-10-08 (P2): "Record Take N" starts without reading again.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LAB_HANDOVER_TTL_MS,
  forgetLabHandover,
  primeLabRoots,
  primeLabSetup,
  primedLabRoots,
  primedLabSetup,
} from "./labEntryHandover";

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

  it("hands over nothing once the window has passed", () => {
    primeLabSetup("arc-1", SETUP);
    primeLabRoots("arc-1", ROOTS);
    vi.setSystemTime(LAB_HANDOVER_TTL_MS);
    expect(primedLabSetup("arc-1")).toEqual(SETUP);
    vi.setSystemTime(LAB_HANDOVER_TTL_MS + 1);
    expect(primedLabSetup("arc-1")).toBeNull();
    expect(primedLabRoots("arc-1")).toBeNull();
  });
});
