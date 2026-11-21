// @vitest-environment jsdom
/*
STORY    As a host I set the recording limit, the baseline, the checkpoints
         and which intervention fires for a moment. As a speaker I am the
         only one who can see or delete what I just gave.
OUTCOME
  O1  The defaults follow the notes: five minutes, both questions, a voice
      sample, checkpoints 1 to 5, and the intervention on each.
  O2  A recording cannot be longer than five minutes.
  O3  The placeholder fires only where the fixed pattern clears the
      threshold, and it says it is not a reading.
  O4  Deleting the speaker's data leaves the host's settings.
PROVES   O1 -> "the defaults match the notes"
         O2 -> "five minutes is the longest recording"
         O3 -> "the placeholder is not a model reading"
         O4 -> "delete removes the speaker and keeps the host settings"
*/
import { afterEach, describe, expect, it } from "vitest";
import {
  PLACEHOLDER_LINE,
  RECORDING_MAX_SECONDS,
  clampRecordingSeconds,
  defaultMomentConfig,
  deleteSpeakerData,
  placeholderReading,
  readMomentConfig,
  readSpeaker,
  saveMomentConfig,
  saveSpeaker,
} from "./momentFlow";

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("moment to intervention", () => {
  it("the defaults match the notes", () => {
    const config = defaultMomentConfig();
    expect(config.recordingSeconds).toBe(RECORDING_MAX_SECONDS);
    expect(config.questions).toEqual({ engaged: true, valence: true });
    expect(config.voiceSample).toBe(true);
    expect(config.checkpoints).toEqual({ "1": true, "2": true, "3": true, "4": true, "5": true });
    expect(config.checkpointInterventions).toEqual({
      "1": ["baselines"],
      "2": ["pace", "ai_audio"],
      "3": ["rewrite"],
      "4": ["rewrite"],
      "5": ["video", "ai_audio"],
    });
    expect(config.meetVisitors).toBe(false);
    expect(config.mappings.find((row) => row.id === "arousal-pace")).toMatchObject({ moment: "arousal", intervention: "pace", on: true });
    expect(config.mappings.find((row) => row.id === "engagement-praise")).toMatchObject({ moment: "engagement", intervention: "praise" });
  });

  it("five minutes is the longest recording", () => {
    expect(clampRecordingSeconds(600)).toBe(300);
    expect(clampRecordingSeconds(0)).toBe(60);
    expect(clampRecordingSeconds(Number.NaN)).toBe(300);
    const saved = saveMomentConfig({ ...defaultMomentConfig(), recordingSeconds: 900 });
    expect(saved.recordingSeconds).toBe(300);
    expect(readMomentConfig().recordingSeconds).toBe(300);
  });

  it("the placeholder is not a model reading", () => {
    const reading = placeholderReading(defaultMomentConfig());
    expect(PLACEHOLDER_LINE).toMatch(/not a reading/i);
    const arousal = reading.find((row) => row.id === "2");
    expect(arousal?.fired.map((hit) => hit.intervention).sort()).toEqual(["ai_audio", "pace"]);
    const clarity = reading.find((row) => row.id === "3");
    expect(clarity?.fired).toEqual([]);
    expect(clarity?.quiet).toEqual(["rewrite"]);
    expect(reading.find((row) => row.id === "1")?.fired[0]).toMatchObject({ intervention: "baselines", shape: "climb" });
  });

  it("delete removes the speaker and keeps the host settings", () => {
    saveMomentConfig({ ...defaultMomentConfig(), recordingSeconds: 120, meetVisitors: true });
    saveSpeaker({ answers: { engaged: "Not engaged" }, voiceSample: true, recorded: true });
    expect(readSpeaker()?.recorded).toBe(true);
    deleteSpeakerData();
    expect(readSpeaker()).toBeNull();
    expect(readMomentConfig()).toMatchObject({ recordingSeconds: 120, meetVisitors: true });
  });
});
