import { describe, expect, it } from "vitest";
import {
  insightView,
  isReportMessage,
  readoutSummaryDraft,
  readoutView,
} from "./loungeReports";

describe("readoutSummaryDraft", () => {
  it("builds a recording_summary draft with topic in body + metadata", () => {
    const d = readoutSummaryDraft({ topic: "Q3 pitch" });
    expect(d.kind).toBe("recording_summary");
    expect(d.role).toBe("system");
    expect(d.body).toBe("Readout · Q3 pitch");
    expect(d.metadata).toMatchObject({ report_type: "readout", topic: "Q3 pitch" });
  });

  it("carries optional metrics + recording id when given", () => {
    const d = readoutSummaryDraft({
      topic: "t",
      recordingId: "r1",
      speechRate: 150,
      pauseRatio: 0.2,
    });
    expect(d.metadata).toMatchObject({
      recording_id: "r1",
      speech_rate: 150,
      pause_ratio: 0.2,
    });
  });

  it("carries session_id so the card opens its readout (item 1)", () => {
    const d = readoutSummaryDraft({ topic: "t", sessionId: "sess-9" });
    expect(d.metadata).toMatchObject({ session_id: "sess-9" });
  });
});

describe("isReportMessage", () => {
  it("is true for report kinds, false otherwise", () => {
    expect(isReportMessage({ kind: "recording_summary" })).toBe(true);
    expect(isReportMessage({ kind: "insight" })).toBe(true);
    expect(isReportMessage({ kind: "text" })).toBe(false);
    expect(isReportMessage({ kind: "status" })).toBe(false);
  });
});

describe("readoutView / insightView", () => {
  it("reads readout metadata", () => {
    expect(
      readoutView({ topic: "t", take_index: 2, speech_rate: 140, pause_ratio: 0.3 })
    ).toEqual({
      topic: "t",
      takeIndex: 2,
      speechRate: 140,
      pauseRatio: 0.3,
    });
  });

  it("drops bad / absent readout fields to null", () => {
    expect(readoutView({ topic: "", speech_rate: "x" })).toEqual({
      topic: null,
      takeIndex: null,
      speechRate: null,
      pauseRatio: null,
    });
    expect(readoutView(null)).toEqual({
      topic: null,
      takeIndex: null,
      speechRate: null,
      pauseRatio: null,
    });
  });

  it("reads insight metadata, defaulting absent fields to null", () => {
    expect(
      insightView({
        overall_message: "nice work",
        note_count: 3,
        topic: "My talk",
        take_index: 1,
      })
    ).toEqual({
      overallMessage: "nice work",
      noteCount: 3,
      topic: "My talk",
      takeIndex: 1,
    });
    expect(insightView(undefined)).toEqual({
      overallMessage: null,
      noteCount: null,
      topic: null,
      takeIndex: null,
    });
  });
});
