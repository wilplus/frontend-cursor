import { describe, expect, it } from "vitest";
import {
  buildDeckChunks,
  coachMomentForChunk,
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

  it("ACCEPTED IS NOT LOCKED — an approved rider leaves the chunk clean (founder 2026-08-15)", () => {
    // This asserted the opposite until 2026-08-15, when the 2026-08-11 merge
    // of the two final states was overturned on the evidence of what it
    // actually did: accepting flips the suggestion to "approved" for the few
    // milliseconds before the server bakes the change and drops it, so the
    // mark turned GREEN and then settled GREY. The student was shown the
    // final state on the way to the in-between one.
    //
    // Green now means locked in and nothing else. The approved id still
    // survives on the chunk — the modal's "Accepted · not locked in yet"
    // kicker reads it — which is what the last assertion holds.
    const chunks = buildDeckChunks(DOC, parts(), [sug("s1", 0, 10, "approved")]);
    expect(chunks[0].status).toBe("clean");
    expect(chunks[0].part.locked).not.toBe(true);
    expect(chunks[0].approvedIds).toEqual(["s1"]);
    expect(chunks[0].pendingIds).toEqual([]);
  });

  it("a SERVER LOCK is the only thing that reaches locked", () => {
    // The other half of the same ruling: what the student locked in stays
    // green permanently ("that is great" — founder).
    const locked = parts().map((p) => ({ ...p, locked: true }));
    const chunks = buildDeckChunks(DOC, locked, []);
    expect(chunks[0].status).toBe("locked");
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

  it("A LOCKED CHUNK RE-OPENS when something new lands on it (founder 2026-08-11)", () => {
    // "Once locked in but smth new appears there keep iterating and showing
    // the suggestions."
    //
    // The lock used to win here unconditionally, and that single line was the
    // whole of "the feedback engine pipe is dead while it is locked in": the
    // backend served the new take's proposals, `pendingIds` was computed, and
    // nothing the student could see ever read it. The text is deliberately
    // never painted, the mark keys on `status`, and the modal opens its
    // REVIEW face only for waiting — so a proposal on a locked chunk was
    // announced nowhere and openable never.
    const chunks = buildDeckChunks(DOC, parts([1]), [sug("s1", 25, 40)]);
    expect(chunks[1].status).toBe("waiting");
    expect(chunks[1].pendingIds).toEqual(["s1"]);
    // The lock itself is untouched — it is the SERVER's flag and the student
    // re-applies it after deciding. Only the surfaced state moved.
    expect(chunks[1].part.locked).toBe(true);
  });

  it("a locked chunk with NOTHING new stays locked", () => {
    // The other half of the ruling: "keep it there; hide the buttons but show
    // the text". A re-open must need a real proposal, or every locked chunk
    // would sit in the amber breathing state forever.
    const chunks = buildDeckChunks(DOC, parts([1]), []);
    expect(chunks[1].status).toBe("locked");
    expect(chunks[1].pendingIds).toEqual([]);
  });

  it("an APPROVED rider on a locked chunk does not re-open it", () => {
    // Approved is decided. Only UNDECIDED work re-opens the cycle, otherwise
    // accepting a change would immediately re-offer the chunk it settled.
    const chunks = buildDeckChunks(DOC, parts([1]), [
      sug("s1", 25, 40, "approved"),
    ]);
    expect(chunks[1].status).toBe("locked");
    expect(chunks[1].approvedIds).toEqual(["s1"]);
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

describe("coachMomentForChunk — the coach's feedback finds its words", () => {
  const chunks = () => buildDeckChunks(DOC, parts(), []);
  const moment = (over: Record<string, unknown> = {}) => ({
    snippetId: "snip-1",
    anchor: "Nobody believed the numbers.",
    hasExplanation: true,
    ...over,
  });

  it("lands on the chunk whose words the anchor sits in", () => {
    const found = coachMomentForChunk([moment()], DOC, chunks()[1]);
    expect(found?.snippetId).toBe("snip-1");
    // …and on no other chunk.
    expect(coachMomentForChunk([moment()], DOC, chunks()[0])).toBeNull();
    expect(coachMomentForChunk([moment()], DOC, chunks()[2])).toBeNull();
  });

  it("ignores a moment the coach left nothing on — an anchor is not feedback", () => {
    expect(
      coachMomentForChunk([moment({ hasExplanation: false })], DOC, chunks()[1])
    ).toBeNull();
    expect(
      coachMomentForChunk([moment({ hasExplanation: undefined })], DOC, chunks()[1])
    ).toBeNull();
  });

  it("surfaces an asynchronous coach-review state before a note exists", () => {
    const found = coachMomentForChunk(
      [moment({ hasExplanation: false, reviewStatus: "pending_coach_review" })],
      DOC,
      chunks()[1]
    );
    expect((found as { reviewStatus?: string } | null)?.reviewStatus).toBe(
      "pending_coach_review"
    );
  });

  it("drops an anchor the document no longer contains — never guessed onto a neighbour", () => {
    // The paragraph was locked and retyped, or a take recomposed the words.
    const stale = moment({ anchor: "Words that are no longer anywhere." });
    for (const c of chunks()) {
      expect(coachMomentForChunk([stale], DOC, c)).toBeNull();
    }
  });

  it("survives a blank or missing anchor rather than matching everything", () => {
    // indexOf("") is 0, which would silently pin every empty anchor to the
    // first chunk — the one bug this shape invites.
    for (const bad of ["", "   "]) {
      expect(coachMomentForChunk([moment({ anchor: bad })], DOC, chunks()[0]))
        .toBeNull();
    }
  });

  it("takes the first matching moment when a chunk carries several", () => {
    const found = coachMomentForChunk(
      [
        moment({ snippetId: "a", anchor: "Nobody believed" }),
        moment({ snippetId: "b", anchor: "the numbers." }),
      ],
      DOC,
      chunks()[1]
    );
    expect(found?.snippetId).toBe("a");
  });

  it("no moments at all is not an error", () => {
    expect(coachMomentForChunk(null, DOC, chunks()[0])).toBeNull();
    expect(coachMomentForChunk([], DOC, chunks()[0])).toBeNull();
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

  it("groups consecutive chunks by their piece slide index when the counts match", () => {
    const groups = groupsFor([0, 0, 1], 2);
    expect(groups.map((g) => g.slideIndex)).toEqual([0, 1]);
    expect(groups[0].chunks).toHaveLength(2);
    expect(groups[1].chunks).toHaveLength(1);
  });

  it("a null mapping inherits the nearest preceding real slide", () => {
    const groups = groupsFor([0, null, null], 1);
    expect(groups.map((g) => g.slideIndex)).toEqual([0]);
    expect(groups[0].chunks).toHaveLength(3);
  });

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

  it("rejects an explicit slide beyond the canonical deck count", () => {
    expect(groupChunksBySlide(chunks(), [0, 1, 3], 3)).toEqual({
      ok: false,
      error: "slide_out_of_range",
      paragraphIndex: 2,
    });
  });

  it("rejects a leading null because it has no real parent slide", () => {
    expect(groupChunksBySlide(chunks(), [null, 0, 1], 2)).toEqual({
      ok: false,
      error: "missing_parent_slide",
      paragraphIndex: 0,
    });
  });

  it("rejects a broken zip instead of guessing an attachment", () => {
    expect(groupChunksBySlide(chunks(), [0, 1], 2)).toEqual({
      ok: false,
      error: "piece_count_mismatch",
      paragraphIndex: null,
    });
  });

  it("rejects a backwards explicit mapping", () => {
    expect(groupChunksBySlide(chunks(), [0, 2, 1], 3)).toEqual({
      ok: false,
      error: "slide_order_regression",
      paragraphIndex: 2,
    });
  });

  it("a known deck without any mapping is an error", () => {
    expect(groupChunksBySlide(chunks(), null, 3)).toEqual({
      ok: false,
      error: "missing_slide_mapping",
      paragraphIndex: null,
    });
  });

  it("a deckless or older unmapped talk remains one untitled section", () => {
    const deckless = groupChunksBySlide(chunks(), [null, null, null], 0);
    expect(deckless.ok).toBe(true);
    if (deckless.ok) expect(deckless.groups[0].slideIndex).toBeNull();

    const older = groupChunksBySlide(chunks(), null, null);
    expect(older.ok).toBe(true);
    if (older.ok) expect(older.groups[0].slideIndex).toBeNull();

    expect(groupChunksBySlide([], null, 3)).toEqual({
      ok: true,
      groups: [],
    });
  });
});
