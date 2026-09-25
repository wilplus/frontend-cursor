/* -------------------------------------------------------------------------- */
/*  THE HISTORY OF LEARNING (founder 2026-09-25) — the read.                   */
/*                                                                            */
/*  The payload crosses the wire as unknown, and a history that renders a      */
/*  chapter it cannot prove is worse than one that renders nothing. These pin  */
/*  the shape and the two refusals: a chapter with no words is not a chapter,  */
/*  and an empty coach block is not "your coach said nothing".                 */
/* -------------------------------------------------------------------------- */
import { describe, expect, it } from "vitest";
import { mapLearningHistory } from "./learningHistory";

describe("reading a history off the wire", () => {
  it("keeps the words, the coach and the practice in order", () => {
    const out = mapLearningHistory({
      entries: [
        {
          version: 1,
          created_at: "2026-09-01T10:00:00Z",
          text: "and that's basically it, thanks",
          take_session_id: "s1",
          coach: {
            title: "Land the last word",
            instruction: "Say the final word at full volume.",
            video_ref: "https://example.com/v.mp4",
            shared_at: "2026-09-02T10:00:00Z",
          },
          practice: [{ attempt_index: 1, recorded_at: "2026-09-03T10:00:00Z" }],
        },
        {
          version: 2,
          created_at: "2026-09-10T10:00:00Z",
          text: "That's the idea. Thank you.",
          take_session_id: "s2",
          coach: null,
          practice: [],
        },
      ],
      history_starts_at: "2026-09-01T10:00:00Z",
    });
    expect(out.entries.map((e) => e.version)).toEqual([1, 2]);
    expect(out.entries[0].coach?.videoRef).toBe("https://example.com/v.mp4");
    expect(out.entries[0].practice).toEqual([
      { attemptIndex: 1, recordedAt: "2026-09-03T10:00:00Z" },
    ]);
    // The rewrite does not erase the chapter it replaced — that is the point.
    expect(out.entries[1].text).toContain("That's the idea");
    expect(out.historyStartsAt).toBe("2026-09-01T10:00:00Z");
  });

  it("drops a chapter with no words rather than drawing a blank one", () => {
    const out = mapLearningHistory({
      entries: [
        { version: 1, text: "   ", practice: [] },
        { version: 2, text: "Real words.", practice: [] },
      ],
    });
    expect(out.entries.map((e) => e.version)).toEqual([2]);
  });

  it("treats an empty coach block as no coach, not as silence from one", () => {
    const out = mapLearningHistory({
      entries: [
        {
          version: 1,
          text: "Words.",
          coach: { title: "", instruction: "", video_ref: "" },
          practice: [],
        },
      ],
    });
    expect(out.entries[0].coach).toBeNull();
  });

  it("survives a payload that is not the shape it claims", () => {
    expect(mapLearningHistory(null).entries).toEqual([]);
    expect(mapLearningHistory("nope").entries).toEqual([]);
    expect(mapLearningHistory({ entries: "nope" }).entries).toEqual([]);
    expect(
      mapLearningHistory({ entries: [{ text: "Words.", practice: "nope" }] })
        .entries[0].practice,
    ).toEqual([]);
  });

  it("carries no score, ratio or verdict across the seam", () => {
    const out = mapLearningHistory({
      entries: [
        {
          version: 1,
          text: "Words.",
          coach: {
            title: "T",
            video_ref: "https://x/v.mp4",
            // A backend that ever sent these must not have them rendered.
            professional_coach_decision: "no",
            power_score: 0.8,
          },
          practice: [{ attempt_index: 1, recorded_at: "t" }],
        },
      ],
    });
    const rendered = JSON.stringify(out);
    expect(rendered).not.toContain("professional_coach_decision");
    expect(rendered).not.toContain("power_score");
  });
});
