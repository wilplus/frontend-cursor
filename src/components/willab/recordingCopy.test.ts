/*
STORY    As the founder, I want the recording screens' words fixed to the
         signed set with no digits or score words, so that nothing unapproved
         or numeric reaches the speaker.
OUTCOME
  O1  Never 4 (no new words without the founder's OK): RECORDING_COPY holds
      exactly the signed keys, typed exactly as signed.
  O2  Never 1 (no scores or numbers): no signed line carries a digit, a % or
      a score word.
  O3  Fixed recording chrome follows the app locale while speaker-authored
      slide words remain untouched.
PROVES   O1, O2 -> "is exactly the signed words, with no digit or score word"
         O3 -> "serves approved English and Polish recording copy without translating a speaker's slide"
WHY      Recording lock 2026-10-07 (N59, N70); the microphone line, N273; the earbuds line, N372. recordingWhere's "Take N ·
         Slide n of m" is pinned in recordingStillFrame.test, not here.
*/
import { describe, expect, it } from "vitest";
import { DEFAULT_DECK } from "@/lib/willab/defaultDeck";
import {
  answerWhere,
  RECORDING_COPY,
  recordingCopy,
  recordingSlidesInLocale,
  recordingWhere,
} from "./recordingCopy";

describe("RECORDING_COPY", () => {
  it("is exactly the signed words, with no digit or score word", () => {
    expect(RECORDING_COPY).toEqual({
      back: "Back",
      nextSlide: "Next slide",
      micReady: "Getting your mic ready",
      micWhy: "WillpowerLab uses the microphone to record your Takes.",
      earbuds: "Earbuds make you sound like a phone call. The built-in mic sounds like you.",
    });
    for (const [key, value] of Object.entries(RECORDING_COPY)) {
      expect(value, key).not.toMatch(/\d|%|score|rank/i);
    }
  });

  it("serves approved English and Polish recording copy without translating a speaker's slide", () => {
    expect(recordingCopy("en")).toMatchObject({
      back: "Back",
      nextSlide: "Next slide",
      finishTake: "Finish take",
    });
    expect(recordingCopy("pl")).toMatchObject({
      back: "Wstecz",
      nextSlide: "Następny slajd",
      finishTake: "Zakończ nagranie",
    });
    expect(recordingWhere(2, 0, 3, null, "en")).toBe("Take 2 · Slide 1 of 3");
    expect(recordingWhere(2, 0, 3, null, "pl")).toBe("Nagranie 2 · Slajd 1 z 3");
    expect(answerWhere("Marta", 1, 3, "pl")).toBe("Marta · Slajd 2 z 3");

    expect(recordingSlidesInLocale(DEFAULT_DECK, "pl")[0]).toMatchObject({
      title: "Początek",
      body: "O czym opowiesz — w jednym zdaniu.",
    });
    const speakerSlide = [{ title: "Opening", body: "My English customer story" }];
    expect(recordingSlidesInLocale(speakerSlide, "pl")).toEqual(speakerSlide);
  });
});
