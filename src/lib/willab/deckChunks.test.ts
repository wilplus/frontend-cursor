import { describe, expect, it } from "vitest";
import { buildDeckChunks, groupChunksBySlide } from "./deckChunks";
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
  it("a chunk with no suggestions and no lock is clean", () => {
    const chunks = buildDeckChunks(DOC, parts(), []);
    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => c.status)).toEqual(["clean", "clean", "clean"]);
    // Identity flows from the served parts — the lock PUT and the deck can
    // never disagree about which part a paragraph is.
    expect(chunks.map((c) => c.part.id)).toEqual([
      "part-0",
      "part-1",
      "part-2",
    ]);
  });

  it("an UNDECIDED suggestion makes its chunk waiting — and only its chunk", () => {
    const chunks = buildDeckChunks(DOC, parts(), [sug("s1", 25, 40)]);
    expect(chunks.map((c) => c.status)).toEqual(["clean", "waiting", "clean"]);
    expect(chunks[1].pendingIds).toEqual(["s1"]);
  });

  it("status null is UNDECIDED (R4) — absence of a decision is pending, never silence", () => {
    const chunks = buildDeckChunks(DOC, parts(), [sug("s1", 0, 10, null)]);
    expect(chunks[0].status).toBe("waiting");
  });

  it("an approved suggestion washes the chunk accepted until it is locked in", () => {
    const chunks = buildDeckChunks(DOC, parts(), [sug("s1", 0, 10, "approved")]);
    expect(chunks[0].status).toBe("accepted");
    expect(chunks[0].approvedIds).toEqual(["s1"]);
    expect(chunks[0].pendingIds).toEqual([]);
  });

  it("waiting beats accepted when both ride one chunk — outstanding feedback is the louder fact", () => {
    const chunks = buildDeckChunks(DOC, parts(), [
      sug("a", 0, 8, "approved"),
      sug("b", 10, 20, "pending"),
    ]);
    expect(chunks[0].status).toBe("waiting");
  });

  it("a dismissed proposal is history — it colours nothing", () => {
    const chunks = buildDeckChunks(DOC, parts(), [sug("s1", 0, 10, "dismissed")]);
    expect(chunks[0].status).toBe("clean");
    expect(chunks[0].pendingIds).toEqual([]);
    expect(chunks[0].approvedIds).toEqual([]);
  });

  it("locked wins over everything — locked text is never re-underlined, even with a pending rider", () => {
    // The Confident-Voice "better version pending" rides a LOCKED part; it
    // surfaces in the modal, never as an underline on the page.
    const chunks = buildDeckChunks(DOC, parts([1]), [sug("s1", 25, 40)]);
    expect(chunks[1].status).toBe("locked");
    // The pending id is still carried — the modal needs it.
    expect(chunks[1].pendingIds).toEqual(["s1"]);
  });

  it("a suggestion spanning two paragraphs marks both waiting", () => {
    const chunks = buildDeckChunks(DOC, parts(), [sug("s1", 20, 30)]);
    expect(chunks.map((c) => c.status)).toEqual([
      "waiting",
      "waiting",
      "clean",
    ]);
  });

  it("a boundary-touching span belongs to the chunk whose words it sits in, not its neighbour", () => {
    // [23, 25) is exactly the blank-line gap after p0 — half-open overlap
    // puts it on neither paragraph's words… but the gap sits inside p1's
    // untrimmed span start? No: spans are [0,23) [25,53) [55,88). A span
    // ending exactly at 23 does not overlap [25,53), and one starting at 53
    // does not overlap [25,53).
    const chunks = buildDeckChunks(DOC, parts(), [sug("s1", 0, 23)]);
    expect(chunks.map((c) => c.status)).toEqual(["waiting", "clean", "clean"]);
  });

  it("blank paragraphs are dropped on both sides, so offsets keep addressing the right chunk", () => {
    const doc = "First words.\n\n\n\nSecond words after a double gap.";
    const p: Part[] = [
      { id: "a", text: "First words." },
      { id: "b", text: "Second words after a double gap." },
    ];
    const chunks = buildDeckChunks(doc, p, [sug("s1", doc.indexOf("Second"), doc.length)]);
    expect(chunks).toHaveLength(2);
    expect(chunks.map((c) => c.status)).toEqual(["clean", "waiting"]);
    expect(chunks[1].part.id).toBe("b");
  });

  it("with no served parts it derives identity fresh — same shape, minted ids", () => {
    const chunks = buildDeckChunks(DOC, null, []);
    expect(chunks).toHaveLength(3);
    expect(new Set(chunks.map((c) => c.part.id)).size).toBe(3);
    expect(chunks.every((c) => c.status === "clean")).toBe(true);
  });
});

describe("groupChunksBySlide — the safe-ahead zip", () => {
  const chunks = () => buildDeckChunks(DOC, parts(), []);

  it("groups consecutive chunks by their piece slide index when the counts match", () => {
    const groups = groupChunksBySlide(chunks(), [0, 0, 1]);
    expect(groups.map((g) => g.slideIndex)).toEqual([0, 1]);
    expect(groups[0].chunks).toHaveLength(2);
    expect(groups[1].chunks).toHaveLength(1);
  });

  it("a piece without slide_index falls back to paragraph i = page i", () => {
    const groups = groupChunksBySlide(chunks(), [0, null, null]);
    // 0, then 1, then 2 — the exact-count zip, never a guess.
    expect(groups.map((g) => g.slideIndex)).toEqual([0, 1, 2]);
  });

  it("a count mismatch yields ONE untitled section — never a guessed attachment", () => {
    const groups = groupChunksBySlide(chunks(), [0, 1]);
    expect(groups).toHaveLength(1);
    expect(groups[0].slideIndex).toBeNull();
    expect(groups[0].chunks).toHaveLength(3);
  });

  it("no pieces at all → one untitled section; no chunks → no sections", () => {
    expect(groupChunksBySlide(chunks(), null)[0].slideIndex).toBeNull();
    expect(groupChunksBySlide([], null)).toEqual([]);
  });
});
