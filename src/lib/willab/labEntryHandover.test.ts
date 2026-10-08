import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LAB_HANDOVER_TTL_MS,
  continuedTakeDeck,
  forgetLabHandover,
  holdLabRoots,
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

  it("forgets them after the short while", () => {
    primeLabRoots("arc-1", ROOTS);
    vi.setSystemTime(LAB_HANDOVER_TTL_MS + 1);
    expect(primedLabRoots("arc-1")).toBeNull();
  });

  it("keeps an empty answer as an answer: the project has no helper words", () => {
    primeLabRoots("arc-1", []);
    expect(primedLabRoots("arc-1")).toEqual([]);
  });
});

describe("the deck a continued Take starts from", () => {
  it("prefers the device's own cached deck, and does not read it again", () => {
    primeLabSetup("arc-1", SETUP);
    const deck = { topic: "Cached", presentationRef: null, slides: [] };
    expect(continuedTakeDeck({ arcId: "arc-1", deck }, true)).toEqual({ deck, primed: false });
  });

  it("starts on the page's setup when the device has none, and says so", () => {
    primeLabSetup("arc-1", SETUP);
    expect(continuedTakeDeck({ arcId: "arc-1" }, true)).toEqual({
      deck: {
        topic: "Pitch",
        audience: "Board",
        presentationRef: "https://r2/deck.pdf",
        slides: [{ title: "One", body: "" }],
        targetLengthSeconds: 300,
      },
      primed: true,
    });
  });

  it("falls back to today's read when nothing was handed over, or signed out", () => {
    expect(continuedTakeDeck({ arcId: "arc-1" }, true)).toEqual({ deck: null, primed: false });
    primeLabSetup("arc-1", SETUP);
    expect(continuedTakeDeck({ arcId: "arc-1" }, false)).toEqual({ deck: null, primed: false });
    expect(continuedTakeDeck(null, true)).toEqual({ deck: null, primed: false });
  });
});

describe("held while helper words are being saved (P2)", () => {
  it("drops the kept words and hands none over until released", () => {
    forgetLabHandover();
    primeLabRoots("arc", [{ partId: "p", slideIndex: 0, text: "old words", type: "flagship" }] as never);
    holdLabRoots("arc", true);
    expect(primedLabRoots("arc")).toBeNull();
    primeLabRoots("arc", [{ partId: "p", slideIndex: 0, text: "stale read", type: "flagship" }] as never);
    expect(primedLabRoots("arc")).toBeNull();
    holdLabRoots("arc", false);
    primeLabRoots("arc", [{ partId: "p", slideIndex: 0, text: "new words", type: "flagship" }] as never);
    expect(primedLabRoots("arc")?.[0]?.text).toBe("new words");
  });
});
