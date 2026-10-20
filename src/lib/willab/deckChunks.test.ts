/*
STORY    As a speaker, I want each paragraph of my Ideal Text deck to show its
         real state (waiting on a suggestion, locked by me, untouched) and to
         sit under its real slide, so that I can trust what is still open and
         where it belongs.
OUTCOME
  O1  Only the paragraph with an undecided suggestion shows waiting.
  O2  Only a server lock shows locked; an approved or dismissed suggestion
      on an unlocked paragraph never does.
  O3  An extra paragraph joins the last slide, never a made-up Slide 4.
PROVES   O1 -> "an UNDECIDED suggestion makes its chunk waiting, and only its chunk"
         O2 -> "a SERVER LOCK is the only thing that reaches locked"
         O3 -> "the fourth paragraph can never manufacture Slide 4 in a three-slide deck"
WHY      Founder 2026-08-15: "accepted" is not "locked".
*/
import { describe, expect, it } from "vitest";
import {
  buildDeckChunks,
  groupChunksBySlide,
} from "./deckChunks";
import type { Part } from "./documentParts";

/* The doc under test: three paragraphs with known char offsets.
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

  it("an UNDECIDED suggestion makes its chunk waiting, and only its chunk", () => {
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
    const lockedSecond = buildDeckChunks(DOC, parts([1]), []);
    expect(lockedSecond.map((c) => c.status)).not.toContain("waiting");
    expect(lockedSecond[1].status).toBe("locked");
    expect(lockedSecond.filter((c) => c.status === "locked")).toHaveLength(1);
    // Decided suggestions on unlocked paragraphs: accepted is not locked.
    const decided = buildDeckChunks(DOC, parts(), [
      sug("a", 0, 10, "approved"),
      sug("d", 25, 40, "dismissed"),
    ]);
    expect(decided.map((c) => c.status)).not.toContain("locked");
    expect(decided.map((c) => c.status)).not.toContain("waiting");
    expect(decided[0].approvedIds).toEqual(["a"]);
  });
});

describe("groupChunksBySlide — canonical deck identity", () => {
  const chunks = () => buildDeckChunks(DOC, parts(), []);

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

