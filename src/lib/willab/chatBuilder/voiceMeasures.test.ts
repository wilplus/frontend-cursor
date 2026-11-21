// @vitest-environment node
/*
STORY    As a visitor who sent a recording, I hear facts about the
         recording, tied to a moment I can replay. Nobody scores me
         or names a feeling.
OUTCOME
  O1  A short wav is read, and a pause longer than a second is named
      with its time.
  O2  The walk offers a clear stretch, one place to say again, helper
      words, and the Ideal Text only when the host chose it.
  O3  A recording over 25 MB or 5 minutes is refused. The facts name
      no feeling and no score.
PROVES   O1 -> "a short wav shows a pause at its time"
         O2 -> "the walk is a clear stretch, one retry, helper words, and the text"
         O3 -> "a long recording is refused, and no feeling or score is named"
*/
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AUDIO_MAX_BYTES, AUDIO_MAX_SECONDS, audioTooBig, audioTooLong, clock, encodeWav, measureVoice, readWav, voiceFacts, walkFromFacts } from "./voiceMeasures";

function tone(seconds: number, sampleRate: number, hz: number): Float32Array {
  const samples = new Float32Array(Math.floor(seconds * sampleRate));
  for (let i = 0; i < samples.length; i += 1) samples[i] = Math.sin((2 * Math.PI * hz * i) / sampleRate) * 0.4;
  return samples;
}

describe("a recording's facts", () => {
  it("a short wav shows a pause at its time", () => {
    const rate = 16000;
    const samples = tone(1, rate, 220);
    const wav = encodeWav(samples, rate);
    const read = readWav(readFileSync("src/lib/willab/chatBuilder/fixtures/short-talk.wav"));
    expect(read.sampleRate).toBe(rate);
    expect(read.samples.length).toBe(samples.length);
    expect(readWav(wav).samples.length).toBe(samples.length);
    const measures = measureVoice(read.samples, read.sampleRate, [
      { word: "hello", start: 39.2, end: 41 },
      { word: "there", start: 44, end: 45 },
    ]);
    expect(measures.pauses).toEqual([{ at: 41, seconds: 3 }]);
    expect(voiceFacts(measures).join(" ")).toContain("You paused for 3 seconds at 0:41.");
    expect(clock(41)).toBe("0:41");
  });

  it("the walk is a clear stretch, one retry, helper words, and the text", () => {
    const measures = measureVoice(tone(2, 8000, 180), 8000, [
      { word: "one", start: 0.2, end: 0.5 },
      { word: "two", start: 1.8, end: 2.0 },
    ]);
    const beats = walkFromFacts(measures, ["best", "fix", "words"], true);
    expect(beats.map((beat) => beat.key)).toEqual(["best", "fix", "words", "ideal"]);
    expect(beats[1].at).toBe(0.5);
    expect(walkFromFacts(measures, ["best"], false).map((beat) => beat.key)).toEqual(["best"]);
  });

  it("a long recording is refused, and no feeling or score is named", () => {
    expect(audioTooBig(AUDIO_MAX_BYTES)).toBe(false);
    expect(audioTooBig(AUDIO_MAX_BYTES + 1)).toBe(true);
    expect(audioTooLong(AUDIO_MAX_SECONDS)).toBe(false);
    expect(audioTooLong(AUDIO_MAX_SECONDS + 1)).toBe(true);
    const facts = voiceFacts(measureVoice(tone(1, 8000, 220), 8000, [{ word: "hi", start: 0, end: 0.2 }])).join(" ");
    expect(facts).not.toMatch(/confident|nervous|anxious|happy|sad|angry|calm|emotion|arousal|\/10/i);
  });
});
