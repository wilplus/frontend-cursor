import { describe, expect, it } from "vitest";
import { groupStrongSides, type LibraryEntry } from "./library";

const entry = (over: Partial<LibraryEntry>): LibraryEntry => ({
  id: "e",
  sessionId: "s1",
  snippetId: "n",
  note: "",
  tag: "strong",
  createdAt: "2026-01-01T00:00:00Z",
  snippet: null,
  slide: null,
  presentationRef: null,
  rank: null,
  sessionTopic: "",
  ...over,
});

const slide = (index: number) => ({ index, title: `S${index}`, body: "" });

describe("groupStrongSides", () => {
  it("puts no-slide strong moments under general and drops to_work_on", () => {
    const v = groupStrongSides([
      entry({ id: "a", tag: "strong" }),
      entry({ id: "b", tag: "to_work_on" }),
    ]);
    expect(v.general.map((e) => e.id)).toEqual(["a"]);
    expect(v.trainings).toEqual([]);
  });

  it("groups slide moments by session + slide, top-3 by rank (best first)", () => {
    const v = groupStrongSides([
      entry({ id: "g", slide: null }), // general
      ...[2, 1, 4, 3].map((rank) =>
        entry({
          id: `m${rank}`,
          sessionId: "s1",
          sessionTopic: "Pitch",
          presentationRef: "u",
          slide: slide(0),
          rank,
        })
      ),
    ]);
    expect(v.general.map((e) => e.id)).toEqual(["g"]);
    expect(v.trainings).toHaveLength(1);
    const t = v.trainings[0];
    expect(t.topic).toBe("Pitch");
    expect(t.presentationRef).toBe("u");
    expect(t.slides).toHaveLength(1);
    // rank-sorted ascending, capped at 3 (rank 4 dropped)
    expect(t.slides[0].moments.map((e) => e.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("orders slides by deck index and trainings by recency (newest first)", () => {
    const v = groupStrongSides([
      entry({ id: "oldB", sessionId: "s1", createdAt: "2026-01-01T00:00:00Z", slide: slide(1) }),
      entry({ id: "oldA", sessionId: "s1", createdAt: "2026-01-02T00:00:00Z", slide: slide(0) }),
      entry({ id: "new", sessionId: "s2", createdAt: "2026-02-01T00:00:00Z", slide: slide(0) }),
    ]);
    expect(v.trainings.map((t) => t.sessionId)).toEqual(["s2", "s1"]);
    expect(v.trainings[1].slides.map((g) => g.slide.index)).toEqual([0, 1]);
  });
});
