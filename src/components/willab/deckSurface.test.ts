import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/* -------------------------------------------------------------------------- */
/*  THE STRIPPED DECK SURFACE (founder 2026-08-11)                             */
/*                                                                            */
/*  Four rulings, all of them subtractions, and subtractions are exactly what  */
/*  creeps back: a later change adds a tint "just for the pending case", a     */
/*  count "just in the corner", a border "so it reads as a card". Each one is  */
/*  defensible on its own and together they rebuild the screen the founder     */
/*  asked to have taken apart.                                                */
/*                                                                            */
/*    1. the text is NEVER painted — no underline, no wash, in any state;      */
/*    2. three chunk states, not four — accepted and locked are one;           */
/*    3. no frame and no height cap around the deck;                          */
/*    4. no footer at all — no review count, no slide position, no words.      */
/* -------------------------------------------------------------------------- */

/** Source with COMMENTS STRIPPED. Every rule below is about what RENDERS, and
 *  the files explain at length which treatments were retired and why — prose
 *  that names "underline" and "accepted" repeatedly. Scanning the raw text
 *  would fail on the record of the decision rather than on a breach of it. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const DECK = code("src/components/willab/TranscriptReviewDeck.tsx");
const MODAL = code("src/components/willab/DeckChunkModal.tsx");
const MARK = code("src/components/willab/DeckLockMark.tsx");
const CHUNKS = code("src/lib/willab/deckChunks.ts");
const READOUT = code("src/components/willab/IdealTextReadout.tsx");
const OVERLAY = code("src/components/willab/IdealTextOverlay.tsx");

describe("the deck surface the founder specced (2026-08-11)", () => {
  it("nothing paints the chunk text — no underline, no wash, no tint", () => {
    // The rule that made the whole screen unreadable when a talk arrived as
    // one chunk: a single pending note striped 233 words amber.
    expect(DECK).not.toMatch(/underline/);
    expect(DECK).not.toMatch(/bg-pending/);
    expect(DECK).not.toMatch(/decoration-/);
    expect(DECK).not.toMatch(/CHUNK_TEXT_CLS/);
  });

  it("the chunk renders its words directly, with the mark beside them", () => {
    // Not merely "no classes today" — no wrapper to hang classes ON.
    expect(DECK).toMatch(/<RichText text=\{c\.part\.text\} \/>\s*<DeckLockMark/);
  });

  it("reveals the frozen feedback inventory before any decision", () => {
    // Up to three belong to the whole Take. If several route to one chunk,
    // the page shows their count and the modal lists every identity up front;
    // resolving #1 may navigate to #2, but can never make a hidden #2 appear.
    expect(DECK).toMatch(/pendingCount=\{c\.pendingIds\.length\}/);
    expect(DECK).toMatch(/pendingSuggestions=\{openSuggestions\}/);
    expect(MODAL).toMatch(/Feedback ready · \{feedbackInventory\.length\}/);
    expect(MODAL).toMatch(/feedbackInventory\.map/);
    expect(MODAL).toMatch(/\.slice\(0, 3\)/);
    expect(MODAL).toMatch(/advanceAfterDecision\(suggestion\.id\)/);
  });

  it("there are THREE chunk states", () => {
    expect(CHUNKS).toMatch(
      /export type ChunkStatus =\s*"clean" \| "waiting" \| "locked";/
    );
    expect(CHUNKS).not.toMatch(/"accepted"/);
    // PRECEDENCE (founder 2026-08-11, the locked-iteration ruling): undecided
    // feedback is tested FIRST and beats everything, including a server lock —
    // "once locked in but smth new appears there keep iterating and showing the
    // suggestions". The lock winning outright is the exact line that made "the
    // feedback engine pipe dead while it is locked in", so the order of these
    // two branches is the fence, not an implementation detail.
    expect(CHUNKS).toMatch(
      /pendingIds\.length > 0\s*\?\s*"waiting"\s*:\s*locked\s*\?\s*"locked"/
    );
    // …and ONLY a server lock reaches "locked" (founder 2026-08-15). The
    // `|| approvedIds.length > 0` rider that used to sit here merged
    // "accepted" into "locked", which made the mark flash green on its way to
    // grey on every accept — the final state shown on the way to the
    // in-between one. Green means locked in, and nothing else may claim it.
    expect(CHUNKS).not.toMatch(/locked \|\| approvedIds/);
    expect(CHUNKS).toMatch(/:\s*"clean";/);
  });

  it("the mark carries all three states and no fourth", () => {
    for (const state of ["clean:", "waiting:", "locked:"]) {
      expect(MARK).toContain(state);
    }
    expect(MARK).not.toMatch(/accepted:/);
  });

  it("the deck has no footer — no review count, no position, no word count", () => {
    expect(DECK).not.toMatch(/to review/);
    expect(DECK).not.toMatch(/Nothing waiting/);
    expect(DECK).not.toMatch(/words/);
    expect(DECK).not.toMatch(/Slide \$\{atSlide/);
    // The dots rail is the surviving "where am I" — it must NOT go with it.
    expect(DECK).toMatch(/screens\.length > 1/);
    expect(DECK).toMatch(/aria-current/);
  });

  it("the rail is PAGES PER SLIDE — two grains, never three", () => {
    // Founder 2026-08-15: "just the pages per slide … one level of hierarchy
    // can be removed, this deepest one."
    //
    // The pill is the SLIDE and each mark inside it is one SCREEN of that
    // slide, so a slide running onto a second screen shows two marks. The
    // active screen used to expand into a capsule of one tick per CHUNK,
    // which made the rail read at three grains at once and restated what the
    // page already showed — the paragraphs are visible on the very screen
    // those ticks described.
    expect(DECK).not.toMatch(/Go to chunk \$\{/);
    expect(DECK).not.toMatch(/scr\.chunks\.map/);
    // And the state that existed only to redraw them is gone with them: chunk
    // position lives in `posRef`, which the scroll gate already reads, so
    // scrolling a screen no longer re-renders the deck per paragraph crossed.
    expect(DECK).not.toMatch(/setAtChunk/);
    expect(DECK).toMatch(/posRef\.current = \{ slide: gi, chunk \}/);
  });

  it("the real deck owns slide identity — paragraphs can never mint slides", () => {
    // Regression for the phantom Slide 4 (2026-08-25): the fourth paragraph
    // used to fall back to index 3 when its piece had no slide_index. A null
    // mapping is a continuation of the preceding real slide; it is never the
    // paragraph ordinal wearing a slide label.
    expect(CHUNKS).not.toMatch(/pieceSlideIndexes\[i\]\s*\?\?\s*i/);
    expect(CHUNKS).toMatch(/slide = previousSlide/);
    // The backend's title array has one slot per real slide, including an
    // empty string for an untitled one. Its length is therefore the bound.
    expect(DECK).toMatch(/const slideCount = slideTitles\?\.length \?\? null/);
    expect(DECK).toMatch(
      /groupChunksBySlide\(chunks, pieceSlideIndexes, slideCount\)/
    );
    // Slide linkage is optional metadata. If it is unprovable, the words
    // remain openable as one unlinked "Your talk" section; no slide number is
    // guessed and the old whole-document error state is gone.
    expect(DECK).toMatch(
      /grouping\.ok\s*\? grouping\.groups\s*:\s*chunks\.length > 0\s*\? \[\{ slideIndex: null/
    );
    expect(DECK).toMatch(/data-slide-linkage=\{grouping\.ok \? "linked" : "unlinked"\}/);
    expect(DECK).not.toMatch(/role="alert"/);
    expect(DECK).not.toMatch(/Couldn&apos;t load your ideal text/);
  });

  it("the readout screen has exactly ONE scroller — the deck", () => {
    // Founder 2026-08-11: "this whole screen is movable and should not be…
    // I can scroll on the slides and on the page, it is one". Two nested
    // scrollers means the slide moves under your thumb and the card moves
    // behind it, and neither gesture is the one you meant. The host band
    // stops scrolling on this state; the deck's snap-scroll is the movement.
    const LAB = code("src/components/willab/LabOverlay.tsx");
    expect(LAB).toMatch(
      /state === "readout" \|\| state === "lab_recording"[\s\S]*?\? "min-h-0 overflow-hidden"[\s\S]*?: "overflow-y-auto"/
    );
    // A MINIMUM height on the deck is what forced the page past the phone.
    // It takes the height that is left, so every link in the chain must be
    // allowed to shrink.
    expect(READOUT).not.toMatch(/min-h-\[\d+rem\][^"]*flex-1 flex-col overflow-hidden/);
    expect(READOUT).toMatch(/flex min-h-0 flex-1 flex-col overflow-hidden/);
    expect(READOUT).toMatch(/flex min-h-0 flex-1 flex-col gap-4/);
  });

  it("routes desktop wheel gestures from the whole surface into that scroller", () => {
    expect(OVERLAY).toMatch(/data-ideal-text-wheel-owner/);
    expect(READOUT).toMatch(/data-ideal-text-wheel-owner/);
    expect(DECK).toMatch(/owner\.addEventListener\("wheel", onWheel/);
    expect(DECK).toMatch(/inner\.scrollTop \+= dy/);
    expect(DECK).not.toMatch(/scroll-smooth overflow-y-auto/);
    const prevent = DECK.indexOf("e.preventDefault()");
    const route = DECK.indexOf("wheelGestureStep(", prevent);
    expect(prevent).toBeGreaterThan(-1);
    expect(route).toBeGreaterThan(prevent);
  });

  it("the modal opens on the WORK, not on the folded page state", () => {
    // `chunk.status` folds "approved, not locked" into "locked", so reading
    // it here sent a chunk with a live proposal to the editor. On a re-opened
    // locked chunk that is the whole feature: the page announces waiting and
    // the modal shows an edit box with no suggestion in it.
    const MODAL = code("src/components/willab/DeckChunkModal.tsx");
    expect(MODAL).toMatch(
      /useState<"review" \| "editor">\(\s*chunk\.pendingIds\.length > 0 && suggestion \? "review" : "editor"/
    );
  });

  it("ONE button, and the lock decides which (founder 2026-08-15)", () => {
    // The 08-12 complaint was "if smth is locked in, why is there a big button
    // to lock it in? and the discard button? and if I click discard nothing
    // happens" — both were no-ops, and Discard was `onClose` wearing another
    // word. That fix hid BOTH on a settled locked chunk. The 08-15 ruling goes
    // to the root: the pair was never two choices. Now it is a toggle of what
    // the icon shows —
    //   unlocked           → Lock in
    //   locked + untouched → Discard, which UNLOCKS (the inverse, not a close)
    //   locked + edited    → Lock in, so the edit can still be saved
    const MODAL = code("src/components/willab/DeckChunkModal.tsx");
    expect(MODAL).toMatch(
      /const lockedAndSettled =\s*chunk\.part\.locked === true && draft === chunk\.part\.text;/
    );
    expect(MODAL).toMatch(/const showUnlock = lockedAndSettled && !!onUnlockPart;/);
    // Discard must NEVER be wired to onClose again — that is the no-op.
    expect(MODAL).not.toMatch(/onClick=\{onClose\}[\s\S]{0,200}Discard/);
    expect(MODAL).toMatch(/onClick=\{\(\) => void unlock\(\)\}/);
    // A host with no unlock capability shows no button rather than a dead one.
    expect(MODAL).toMatch(/lockedAndSettled && !onUnlockPart/);
    // Compared against the SERVED TEXT, never the dirty ref: an edit must
    // bring "Lock in" back or the student cannot save it, and typing a change
    // back to identical leaves nothing to save either.
    expect(MODAL).not.toMatch(/lockedAndSettled = [^;]*dirtyRef/);
  });

  it("the modal has two detents and a continuous Pointer Events drag", () => {
    // Founder 2026-08-11: "Make the modal a bit taller and expandable on
    // swipe to the top."
    const MODAL = code("src/components/willab/DeckChunkModal.tsx");
    // The two detents are different KINDS of constraint, and that is the
    // point rather than an inconsistency:
    //   default  — a CEILING, so a two-line chunk is not stretched into a
    //              sheet of empty space it never asked for;
    //   expanded — an actual HEIGHT, because it only happens when the student
    //              asked for it, and a ceiling they may never reach makes the
    //              gesture a no-op on exactly the short chunks where the room
    //              was free. The e2e caught that: both detents measured 390px
    //              on a 900px viewport, the class changed and the sheet did
    //              not.
    //
    // Since 2026-08-15 the Confident Voice card takes the taller detent on
    // open, without a gesture: it carries a player, an explanation and a
    // question, and a question arriving half below the fold gets answered
    // by whoever scrolls — a bias in which moments reach the album, not a layout
    // nit. The two detents are unchanged; one more thing reaches the tall
    // one.
    expect(MODAL).toMatch(
      /expanded \|\| isConfidentVoice\s*\?\s*"h-\[97dvh\] max-h-\[97dvh\]/
    );
    expect(MODAL).toMatch(/:\s*"h-\[68dvh\] max-h-\[68dvh\]/);
    // dvh, not vh: on a phone 100vh sits behind the URL bar, which would put
    // the decision buttons under the browser chrome.
    expect(MODAL).toMatch(/dvh\]/);
    expect(MODAL).toMatch(/onPointerDown=\{onSheetPointerDown\}/);
    expect(MODAL).toMatch(/onPointerMove=\{onSheetPointerMove\}/);
    expect(MODAL).toMatch(/style=\{dragHeight === null/);
  });

  it("the grabber is a real button, so the second detent is not touch-only", () => {
    // Swipe alone leaves the taller state unreachable by keyboard, by switch
    // control, and on a desktop trackpad.
    const MODAL = code("src/components/willab/DeckChunkModal.tsx");
    expect(MODAL).toMatch(/aria-expanded=\{expanded\}/);
    expect(MODAL).toMatch(/onClick=\{toggleExpanded\}/);
  });

  it("swiping the modal DOWN collapses it — it never closes it", () => {
    // Dismissing a review with the same gesture that resizes it would throw
    // away an undecided suggestion on a slip of the thumb. The close button
    // and the backdrop are both already there for a deliberate exit.
    const MODAL = code("src/components/willab/DeckChunkModal.tsx");
    const grabStart = MODAL.indexOf("function finishSheetDrag");
    const grab = MODAL.slice(grabStart, MODAL.indexOf("\n  return (", grabStart));
    expect(grab).toMatch(/setExpanded\(drag\.height >=/);
    expect(grab).not.toMatch(/onClose/);
  });

  it("the lock shows that the coach left something on these words", () => {
    // Founder 2026-08-11: "if there was a video feedack even on a locked
    // screen you can still see that feedback". It was already REACHABLE —
    // every mark opens the modal, the coach card lives on both faces — but
    // only by opening chunks one at a time to find out which had it. On a
    // LOCKED chunk that is the whole problem: the lock is the final state, so
    // nothing else would make the student open it again.
    const DECK_SRC = code("src/components/willab/TranscriptReviewDeck.tsx");
    expect(DECK_SRC).toMatch(
      /hasCoach=\{\s*coachMomentForChunk\(coachMoments, doc, c\)\s*\?\.hasExplanation === true\s*\}/
    );
    expect(DECK_SRC).toMatch(/reviewStatus=\{/);
    expect(MARK).toMatch(/hasCoach/);
    // AC-9: an existence flag, never a count or a band.
    expect(MARK).not.toMatch(/coachCount|momentCount|\bscore\b/);
    // No new user-facing copy — the mark reuses the coach card's own
    // signed-off label (LIVE LOOP).
    expect(MARK).toMatch(/const COACH_LABEL = "Coach note:";/);
  });

  it("the metered feedback read still fires only on the tap, not on the page", () => {
    // The dot comes from `has_explanation`, a FREE flag already on the
    // ideal-text payload. Deriving it by fetching would bill the insights
    // price for every chunk on screen.
    const DECK_SRC = code("src/components/willab/TranscriptReviewDeck.tsx");
    expect(DECK_SRC).not.toMatch(/fetchArcFeedback/);
    const COACH = code("src/components/willab/DeckCoachFeedback.tsx");
    expect(COACH).toMatch(/onClick=\{\(\) => void open\(\)\}/);
  });

  it("the deck mount has no frame and no height cap", () => {
    const mount = READOUT.slice(
      READOUT.indexOf("<TranscriptReviewDeck") - 400,
      READOUT.indexOf("<TranscriptReviewDeck")
    );
    expect(mount).not.toMatch(/border/);
    expect(mount).not.toMatch(/\bh-\[\d+vh\]/);
  });
});
