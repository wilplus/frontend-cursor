import { describe, expect, it } from "vitest";
import { mapStrengths } from "./strengths";

describe("mapStrengths", () => {
  it("maps general + trainings (snake → camel) and keeps empty slides", () => {
    const v = mapStrengths({
      general: [
        {
          transcript: "hi",
          note: "good values",
          audio_ref: "a",
          start_offset_ms: 100,
          duration_ms: 2000,
        },
        { transcript: "", note: "", audio_ref: null }, // nothing renderable → dropped
      ],
      trainings: [
        {
          session_id: "s1",
          topic: "Pitch",
          created_at: "2026-02-01",
          presentation_ref: "u",
          title_slide: { index: 0, title: "Cover", body: "" },
          slides: [
            {
              index: 0,
              title: "Cover",
              body: "",
              strong_snippets: [
                {
                  transcript: "open",
                  note: "n",
                  audio_ref: "a",
                  start_offset_ms: 0,
                  duration_ms: 1000,
                  rank: 1,
                },
              ],
            },
            { index: 1, title: "Body", body: "x", strong_snippets: [] }, // kept
          ],
        },
      ],
    });

    expect(v.general).toHaveLength(1);
    expect(v.general[0]).toEqual({
      transcript: "hi",
      note: "good values",
      audioRef: "a",
      startOffsetMs: 100,
      durationMs: 2000,
      rank: null,
      features: null,
    });

    expect(v.trainings).toHaveLength(1);
    const t = v.trainings[0];
    expect(t.topic).toBe("Pitch");
    expect(t.presentationRef).toBe("u");
    expect(t.titleSlide?.index).toBe(0);
    expect(t.slides).toHaveLength(2);
    expect(t.slides[0].moments[0].rank).toBe(1);
    expect(t.slides[1].moments).toEqual([]); // empty slide preserved
  });

  it("defaults to an empty view on a bad / blank body", () => {
    expect(mapStrengths(null)).toEqual({ general: [], trainings: [] });
    expect(mapStrengths({})).toEqual({ general: [], trainings: [] });
  });

  it("drops a training with no session_id", () => {
    expect(mapStrengths({ trainings: [{ topic: "x" }] }).trainings).toEqual([]);
  });
});
