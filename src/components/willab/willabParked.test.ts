/*
 * STORY    As a speaker, I want a Take I parked to come back intact, so that
 *          I can pick up where I left off.
 * OUTCOME
 *   O1  A parked readout survives a reload with all its fields.
 *   O2  A readout parked by an older app (no slide fields) comes back with
 *       safe defaults instead of crashing the resume.
 *   O3  A corrupt or foreign payload reads as "nothing parked", never a throw.
 * PROVES   O1 -> "round-trips a current payload with every field"
 *          O2 -> "fills in the fields an older payload lacks"
 *          O3 -> "reads a corrupt payload as nothing parked"
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readParked, writeParked, type ParkedReadout } from "./willabParked";

type WinShim = {
  window?: { localStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> };
};

const KEY = "willab.parked";
let store: Map<string, string>;

beforeEach(() => {
  store = new Map<string, string>();
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

const PARKED: ParkedReadout = {
  projectId: "project-pitch",
  sessionId: "session-1",
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
    voiceMetricsAvailable: false,
    parentAudioRef: "audio/parent.webm",
    audience: "investors",
    auditPaid: false,
  },
};

describe("willabParked.readParked", () => {
  it("round-trips a current payload with every field", () => {
    writeParked(PARKED);
    expect(readParked()).toEqual(PARKED);
  });

  it("fills in the fields an older payload lacks", () => {
    store.set(
      KEY,
      JSON.stringify({ projectId: "project-old", topic: "Old", readout: { snippets: [] } }),
    );
    const p = readParked()!;
    expect(p.projectId).toBe("project-old");
    expect(p.sessionId).toBeNull();
    expect(p.readout.slides).toEqual([]);
    expect(p.readout.slideTranscripts).toEqual([]);
    expect(p.readout.feedbackItems).toEqual([]);
    expect(p.readout.voiceMetricsAvailable).toBe(true);
    expect(p.readout.auditPaid).toBe(true);
  });

  it("reads a corrupt payload as nothing parked", () => {
    store.set(KEY, "{not json");
    expect(readParked()).toBeNull();
    store.set(KEY, JSON.stringify({ projectId: "p", readout: { snippets: "nope" } }));
    expect(readParked()).toBeNull();
  });
});
