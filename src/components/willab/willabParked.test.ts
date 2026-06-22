import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readParked, writeParked, clearParked } from "./willabParked";

type WinShim = {
  window?: { localStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> };
};

beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as unknown as WinShim).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  };
});

afterEach(() => {
  delete (globalThis as unknown as WinShim).window;
});

describe("willabParked.readParked", () => {
  it("returns null when nothing is parked or the payload is invalid", () => {
    expect(readParked()).toBeNull();
    window.localStorage.setItem("willab.parked", JSON.stringify({ topic: "x" }));
    expect(readParked()).toBeNull(); // no readout
    window.localStorage.setItem(
      "willab.parked",
      JSON.stringify({ readout: { snippets: "nope" } })
    );
    expect(readParked()).toBeNull(); // snippets not an array
  });

  it("defaults slides + slideTranscripts to [] for a readout parked by an older app version", () => {
    // Simulate a pre-upgrade parked payload: no slides / slideTranscripts.
    window.localStorage.setItem(
      "willab.parked",
      JSON.stringify({ sessionId: "s1", topic: "T", readout: { snippets: [] } })
    );
    const p = readParked();
    expect(p).not.toBeNull();
    expect(p!.readout.slides).toEqual([]);
    expect(p!.readout.slideTranscripts).toEqual([]);
    expect(p!.sessionId).toBe("s1");
  });

  it("round-trips a current payload, preserving the new fields", () => {
    writeParked({
      sessionId: null,
      topic: "Pitch",
      readout: {
        snippets: [],
        overallMessage: null,
        videoRef: null,
        presentationRef: null,
        slides: [{ index: 0, title: "Cover", body: "" }],
        slideTranscripts: [
          { index: 0, transcript: "hi", startOffsetMs: 0, durationMs: 1000 },
        ],
      },
    });
    const p = readParked();
    expect(p!.readout.slides).toHaveLength(1);
    expect(p!.readout.slideTranscripts[0]?.transcript).toBe("hi");
  });

  it("clears the parked readout", () => {
    writeParked({
      sessionId: null,
      topic: "T",
      readout: {
        snippets: [],
        overallMessage: null,
        videoRef: null,
        presentationRef: null,
        slides: [],
        slideTranscripts: [],
      },
    });
    clearParked();
    expect(readParked()).toBeNull();
  });
});
