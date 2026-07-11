import { describe, expect, it } from "vitest";
import {
  mapReadoutPayload,
  mapSayItStronger,
  mapFullTranscriptChunk,
} from "./readout";

describe("mapSayItStronger", () => {
  it("maps a full suggestion", () => {
    const s = mapSayItStronger({
      already_strong: false,
      upgrades: [
        { original: "kind of", upgrade: "clearly", reason: "hedge removed" },
        { original: "", upgrade: "" }, // dropped (no content)
      ],
      rewrite_your_voice: "Say it plainly.",
      rewrite_polished: "State it precisely.",
      why: "Tighter than your average line here.",
    });
    expect(s).not.toBeNull();
    expect(s!.alreadyStrong).toBe(false);
    expect(s!.upgrades).toHaveLength(1);
    expect(s!.upgrades[0]).toEqual({
      original: "kind of",
      upgrade: "clearly",
      reason: "hedge removed",
    });
    expect(s!.rewriteYourVoice).toBe("Say it plainly.");
    expect(s!.why).toBe("Tighter than your average line here.");
  });

  it("nulls why + reason when the BE output-guard stripped them (AC-9)", () => {
    const s = mapSayItStronger({
      upgrades: [{ original: "a", upgrade: "b", reason: "" }],
      rewrite_your_voice: "x",
      rewrite_polished: "y",
      why: "",
    });
    expect(s!.why).toBeNull();
    expect(s!.upgrades[0]?.reason).toBeNull();
  });

  it("carries already_strong", () => {
    const s = mapSayItStronger({
      already_strong: true,
      upgrades: [],
      rewrite_your_voice: "same",
      rewrite_polished: "same",
      why: null,
    });
    expect(s!.alreadyStrong).toBe(true);
  });

  it("returns null for absent / empty (not-generated-yet contract)", () => {
    expect(mapSayItStronger(null)).toBeNull();
    expect(mapSayItStronger(undefined)).toBeNull();
    expect(
      mapSayItStronger({ upgrades: [], rewrite_your_voice: "", rewrite_polished: "" })
    ).toBeNull();
  });
});

describe("mapFullTranscriptChunk + payload fold", () => {
  it("requires a numeric index; maps user_edited_text", () => {
    expect(mapFullTranscriptChunk({ transcript: "hi" })).toBeNull();
    expect(
      mapFullTranscriptChunk({ index: 0, transcript: "hi", user_edited_text: "hey" })
    ).toEqual({ index: 0, transcript: "hi", userEditedText: "hey" });
    expect(
      mapFullTranscriptChunk({ index: 1, transcript: "", user_edited_text: "" })
    ).toEqual({ index: 1, transcript: "", userEditedText: null });
  });

  it("folds + sorts full_transcript_chunks onto the payload", () => {
    const p = mapReadoutPayload({
      snippets: [],
      full_transcript_chunks: [
        { index: 1, transcript: "second" },
        { index: 0, transcript: "first" },
      ],
    });
    expect(p.fullTranscriptChunks.map((c) => c.transcript)).toEqual([
      "first",
      "second",
    ]);
  });

  it("maps a snippet's say_it_stronger + user_edited_text", () => {
    const p = mapReadoutPayload({
      snippets: [
        {
          id: "a",
          user_edited_text: "my edit",
          say_it_stronger: {
            already_strong: true,
            upgrades: [],
            rewrite_your_voice: "same",
            rewrite_polished: "same",
          },
        },
      ],
    });
    expect(p.snippets[0]?.userEditedText).toBe("my edit");
    expect(p.snippets[0]?.sayItStronger?.alreadyStrong).toBe(true);
  });
});
