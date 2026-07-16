import { describe, expect, it } from "vitest";
import {
  mapReadoutPayload,
  mapSayItStronger,
  mapFullTranscriptChunk,
  mapInstantChunk,
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
      kind: "upgrade",
      scope: "word",
    });
    expect(s!.rewriteYourVoice).toBe("Say it plainly.");
    expect(s!.why).toBe("Tighter than your average line here.");
  });

  it("maps the #190 scope discriminator (phrase; absent/unknown → word)", () => {
    const s = mapSayItStronger({
      upgrades: [
        { original: "kind of great", upgrade: "excellent", scope: "phrase" },
        { original: "great", upgrade: "excellent", scope: "word" },
        { original: "a", upgrade: "b" }, // absent → word
        { original: "c", upgrade: "d", scope: "sentence" }, // unknown → word
      ],
      rewrite_your_voice: "x",
      rewrite_polished: "y",
    });
    expect(s!.upgrades.map((u) => u.scope)).toEqual([
      "phrase",
      "word",
      "word",
      "word",
    ]);
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

  it("maps the E1 kind discriminator (filler/overuse; absent/unknown → upgrade)", () => {
    const s = mapSayItStronger({
      upgrades: [
        { original: "um", upgrade: "(pause)", kind: "filler" },
        { original: "great", upgrade: "compelling", kind: "overuse" },
        { original: "a", upgrade: "b", kind: "nonsense" },
      ],
      rewrite_your_voice: "x",
      rewrite_polished: "y",
    });
    expect(s!.upgrades.map((u) => u.kind)).toEqual([
      "filler",
      "overuse",
      "upgrade",
    ]);
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

  it("keeps a BARE already_strong verdict (no upgrades, no rewrites) — the affirming line must render", () => {
    const s = mapSayItStronger({ already_strong: true, upgrades: [] });
    expect(s).not.toBeNull();
    expect(s!.alreadyStrong).toBe(true);
    expect(s!.upgrades).toEqual([]);
  });
});

describe("mapFullTranscriptChunk + payload fold", () => {
  it("requires a numeric index; maps user_edited_text", () => {
    expect(mapFullTranscriptChunk({ transcript: "hi" })).toBeNull();
    expect(
      mapFullTranscriptChunk({ index: 0, transcript: "hi", user_edited_text: "hey" })
    ).toEqual({
      index: 0,
      transcript: "hi",
      userEditedText: "hey",
      startOffsetMs: 0,
      durationMs: 0,
    });
    expect(
      mapFullTranscriptChunk({ index: 1, transcript: "", user_edited_text: "" })
    ).toEqual({
      index: 1,
      transcript: "",
      userEditedText: null,
      startOffsetMs: 0,
      durationMs: 0,
    });
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

  it("picks the audience from session_context or top-level; blank → null", () => {
    expect(
      mapReadoutPayload({ snippets: [], session_context: { audience: "investors" } })
        .audience
    ).toBe("investors");
    expect(
      mapReadoutPayload({ snippets: [], audience: " the board " }).audience
    ).toBe("the board");
    expect(
      mapReadoutPayload({ snippets: [], session_context: { audience: "  " } })
        .audience
    ).toBeNull();
    expect(mapReadoutPayload({ snippets: [] }).audience).toBeNull();
  });

  it("maps chunk audio spans (absent → 0/0, play control hidden)", () => {
    const p = mapReadoutPayload({
      snippets: [],
      full_transcript_chunks: [
        { index: 0, transcript: "a", start_offset_ms: 500, duration_ms: 4000 },
        { index: 1, transcript: "b" },
      ],
    });
    expect(p.fullTranscriptChunks[0]).toMatchObject({
      startOffsetMs: 500,
      durationMs: 4000,
    });
    expect(p.fullTranscriptChunks[1]).toMatchObject({
      startOffsetMs: 0,
      durationMs: 0,
    });
  });

  it("maps an instant piece with #190 fields (slide_index, snippet_id, auto_comment, user_edited_text)", () => {
    const c = mapInstantChunk({
      index: 2,
      slide_index: 1,
      transcript: "Welcome everyone.",
      snippet_id: "snip-7",
      start_offset_ms: 1500,
      duration_ms: 4200,
      auto_comment: "Sounded rather confident here.",
      user_edited_text: "Welcome, everyone.",
      say_it_stronger: {
        upgrades: [{ original: "everyone", upgrade: "all of you", scope: "word" }],
        rewrite_your_voice: "Welcome, all of you.",
        rewrite_polished: "A warm welcome to all of you.",
      },
    });
    expect(c).toEqual({
      index: 2,
      text: "Welcome everyone.",
      slideIndex: 1,
      snippetId: "snip-7",
      startOffsetMs: 1500,
      durationMs: 4200,
      autoComment: "Sounded rather confident here.",
      userEditedText: "Welcome, everyone.",
      // #199 — absent here (this payload predates the approval set) → null.
      appliedUpgradeIndexes: null,
      sayItStronger: expect.objectContaining({ alreadyStrong: false }),
    });
  });

  it("instant piece: absent optional fields → null (deckless / pre-coach)", () => {
    const c = mapInstantChunk({ index: 0, transcript: "hi" });
    expect(c).toMatchObject({
      slideIndex: null,
      snippetId: null,
      autoComment: null,
      userEditedText: null,
      sayItStronger: null,
    });
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
