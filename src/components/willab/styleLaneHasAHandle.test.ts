import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildDeckChunks, styleFor } from "@/lib/willab/deckChunks";

/* -------------------------------------------------------------------------- */
/*  THE STYLE LANE'S HANDLE (founder 2026-08-12)                               */
/*                                                                            */
/*  The post-lock style lane came back the same day it was un-parked, and it   */
/*  landed in exactly the state the coach note was in before the dot: the      */
/*  proposal lives ONLY inside the chunk's modal (the page never re-marks      */
/*  locked text), every mark is clickable, and nothing told the student WHICH  */
/*  locked chunk was worth re-opening. A door with no handle.                  */
/*                                                                            */
/*  The founder's ruling: an amber pulse on the LOCKED pill. "It keeps the     */
/*  surface clean, invents no new glyphs, and intuitively says 'locked, but a  */
/*  finishing touch is inside.'"                                              */
/*                                                                            */
/*  What this file guards is the SHAPE of that ruling, because every part of   */
/*  it is the kind of thing a later change erodes one defensible step at a     */
/*  time — a fourth status "just for style", a new icon "so it reads", a new   */
/*  sentence "so it's clear", the amber creeping onto an unlocked chunk.       */
/* -------------------------------------------------------------------------- */

/** Source with COMMENTS STRIPPED — the prose above and in the components
 *  names "glyph", "fourth state" and "Style" repeatedly, and scanning the raw
 *  text would fail on the record of the decision rather than a breach of it. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const MARK = code("src/components/willab/DeckLockMark.tsx");
const DECK = code("src/components/willab/TranscriptReviewDeck.tsx");
const MODAL = code("src/components/willab/DeckChunkModal.tsx");
const CHUNKS = code("src/lib/willab/deckChunks.ts");

describe("the locked pill's amber pulse", () => {
  it("is a MODIFIER, not a fourth chunk status", () => {
    // The whole point of the ruling: the chunk really is locked and really
    // is decided. A fourth status would make the deck's state machine lie
    // about that in order to advertise an optional extra.
    expect(CHUNKS).toMatch(
      /export type ChunkStatus =\s*"clean" \| "waiting" \| "locked"/
    );
    expect(MARK).not.toMatch(/"styled"|'styled'|styleStatus/);
  });

  it("invents no new glyph — the closed lock and the tick both stay", () => {
    // lucide imports are the glyph inventory; the ruling adds none.
    const imports = MARK.match(/import \{([^}]*)\} from "lucide-react"/);
    expect(imports?.[1].trim()).toBe("Check, Lock, LockOpen");
    // The tick is keyed on the STATUS, so it cannot be switched off by the
    // modifier — a locked chunk with a style proposal is still decided.
    expect(MARK).toMatch(/status === "locked" \? \(/);
  });

  it("reuses the waiting state's amber and its breathing", () => {
    expect(MARK).toMatch(/ring-pending/);
    expect(MARK).toMatch(/motion-safe:animate-lock-breathe/);
  });

  it("degrades to a plain locked pill under reduced motion", () => {
    // The ring carries it on its own; EVERY use of the animation is
    // motion-safe, the waiting state's included.
    const hits = MARK.match(/[\w:-]*animate-lock-breathe/g) ?? [];
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(h).toBe("motion-safe:animate-lock-breathe");
  });

  it("only fires on a LOCKED chunk", () => {
    // On a waiting chunk the pill already breathes for the content
    // feedback, which outranks style; on a clean one there is no lock for a
    // post-lock lane to have fired on.
    expect(MARK).toMatch(/hasStyle && status === "locked"/);
  });

  it("introduces no new user-facing string", () => {
    // Same discipline as the coach dot: the aria label is assembled from
    // the state line plus the two cards' OWN kickers. The style label must
    // be the modal's, verbatim — two spellings of one thing is how a second
    // vocabulary starts.
    expect(MARK).toMatch(/const STYLE_LABEL = "Style";/);
    expect(MODAL).toMatch(/\n\s*Style\n/);
  });

  it("the deck actually hangs the handle, per chunk", () => {
    // Without this the flag exists and nothing ever sets it — which is the
    // exact failure the ruling was about.
    expect(DECK).toMatch(/hasStyle=\{styleFor\(styleChanges, c\) !== null\}/);
  });

  it("still paints nothing on the words themselves", () => {
    // The standing deck rule, re-asserted here because this change is the
    // first thing in months with a legitimate reason to want a tint.
    expect(DECK).not.toMatch(/bg-pending/);
    expect(DECK).not.toMatch(/underline/);
  });
});

/* ------------------------------ the join itself ---------------------------- */

const DOC = "First chunk here.\n\nSecond chunk here.\n\nThird chunk here.";

function chunks() {
  return buildDeckChunks(DOC, null, []);
}

function style(
  start: number,
  end: number,
  status: "pending" | "approved" | "dismissed" | null = "pending"
) {
  return { id: `s${start}`, start, end, status };
}

describe("styleFor — which chunk a style proposal belongs to", () => {
  it("returns the proposal whose span overlaps the chunk", () => {
    const [c0, c1, c2] = chunks();
    const s = style(c1.start + 2, c1.start + 8);
    expect(styleFor([s], c1)?.id).toBe(s.id);
    expect(styleFor([s], c0)).toBeNull();
    expect(styleFor([s], c2)).toBeNull();
  });

  it("a DECIDED proposal is history and lights nothing", () => {
    const [, c1] = chunks();
    const at = [c1.start + 2, c1.start + 8] as const;
    expect(styleFor([style(...at, "approved")], c1)).toBeNull();
    expect(styleFor([style(...at, "dismissed")], c1)).toBeNull();
    // null = UNDECIDED (R4) — absence of a decision is pending, the same
    // ground truth the BE's ledger follows. Coercing it would hide the lane.
    expect(styleFor([style(...at, null)], c1)).not.toBeNull();
  });

  it("nothing to show is null, never a throw", () => {
    const [c0] = chunks();
    expect(styleFor(null, c0)).toBeNull();
    expect(styleFor(undefined, c0)).toBeNull();
    expect(styleFor([], c0)).toBeNull();
  });

  it("a proposal that touches a boundary belongs to ONE chunk", () => {
    // Half-open on both sides: the mark must not light up two pills for one
    // proposal, which is what an inclusive comparison would do.
    const [c0, c1] = chunks();
    const s = style(c1.start, c1.start + 5);
    expect(styleFor([s], c0)).toBeNull();
    expect(styleFor([s], c1)?.id).toBe(s.id);
  });
});
