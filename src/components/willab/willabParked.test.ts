import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readParked, writeParked } from "./willabParked";

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

  it("round-trips a current payload, preserving the new fields", () => {
    writeParked({
      projectId: "project-pitch",
      sessionId: null,
      topic: "Pitch",
      readout: {
        snippets: [],
        feedbackItems: [],
        overallMessage: null,
        presentationRef: null,
        slides: [{ index: 0, title: "Cover", body: "" }],
        slideTranscripts: [
          { index: 0, transcript: "hi", startOffsetMs: 0, durationMs: 1000 },
        ],
        fullTranscriptChunks: [],
        instantChunks: [],
        voiceMetricsAvailable: true,
        parentAudioRef: null,
        audience: null,
        auditPaid: true,
      },
    });
    const p = readParked();
    expect(p!.readout.slides).toHaveLength(1);
    expect(p!.readout.slideTranscripts[0]?.transcript).toBe("hi");
  });
});
