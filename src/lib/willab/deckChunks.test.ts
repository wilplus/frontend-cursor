import { describe, expect, it } from "vitest";
import {
  buildDeckChunks,
  groupChunksBySlide,
} from "./deckChunks";
import type { Part } from "./documentParts";

/* The deck's derived state machine (Lovable §2), pinned where it is pure.
 * The doc under test: three paragraphs with known char offsets.
 *   p0 "We started in a garage."            [0, 23)
 *   p1 "Nobody believed the numbers."       [25, 53)
 *   p2 "Then the launch moved everything."  [55, 88)
 */
const DOC =
  "We started in a garage.\n\nNobody believed the numbers.\n\nThen the launch moved everything.";

const sug = (
  id: string,
  start: number,
  end: number,
  status: "pending" | "approved" | "dismissed" | null = "pending"
) => ({ id, start, end, status });

const parts = (locked: number[] = []): Part[] =>
  [
    "We started in a garage.",
    "Nobody believed the numbers.",
    "Then the launch moved everything.",
  ].map((text, i) => ({
    id: `part-${i}`,
    text,
    locked: locked.includes(i),
  }));

describe("buildDeckChunks — status derivation", () => {

  it("an UNDECIDED suggestion makes its chunk waiting — and only its chunk", () => {
    const chunks = buildDeckChunks(DOC, parts(), [sug("s1", 25, 40)]);
    expect(chunks.map((c) => c.status)).toEqual([
      "untouched",
      "waiting",
      "untouched",
    ]);
    expect(chunks[1].pendingIds).toEqual(["s1"]);
  });

  it("a SERVER LOCK is the only thing that reaches locked", () => {
    // The other half of the same ruling: what the student locked in stays
    // green permanently ("that is great" — founder).
    const locked = parts().map((p) => ({ ...p, locked: true }));
    const chunks = buildDeckChunks(DOC, locked, []);
    expect(chunks[0].status).toBe("locked");
  });
});

describe("groupChunksBySlide — canonical deck identity", () => {
  const chunks = () => buildDeckChunks(DOC, parts(), []);
  const groupsFor = (
    indexes: readonly (number | null)[] | null,
    slideCount: number | null
  ) => {
    const result = groupChunksBySlide(chunks(), indexes, slideCount);
    if (!result.ok) throw new Error(result.error);
    return result.groups;
  };

  it("the fourth paragraph can never manufacture Slide 4 in a three-slide deck", () => {
    const base = chunks();
    const fourth = {
      ...base[2],
      paragraphIndex: 3,
      part: { ...base[2].part, id: "p4", text: "One final line." },
    };
    const result = groupChunksBySlide(
      [...base, fourth],
      [0, 1, 2, null],
      3
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.groups.map((g) => g.slideIndex)).toEqual([0, 1, 2]);
    expect(result.groups[2].chunks).toHaveLength(2);
  });
});

