// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  F1 surface net (audit Q-T8, Phase 2) — the per-slide review modal.         */
/*                                                                            */
/*  Renders the REAL component with fixture payloads and asserts two things   */
/*  the source-grep fences could not:                                         */
/*    1. AC-9 as behaviour: nothing that reads as a score, ratio, percentage  */
/*       or verdict appears in the rendered text, for every feedback family,  */
/*       including when the fixture carries numeric-looking fields.           */
/*    2. The three Manager lanes each render their own face: Confident Voice  */
/*       (the agree question), the actionable rewrite (Accept / Keep mine),   */
/*       and evidence-backed praise (nothing to decide).                      */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DeckChunkModal from "./DeckChunkModal";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";
import type { RootPhraseSpan } from "@/services/api/partLock";

vi.mock("@/hooks/useVisibleLearningExposure", () => ({
  useVisibleLearningExposure: () => undefined,
}));
vi.mock("@/components/results/MediaPlayer", () => ({
  default: () => createElement("div", { "data-testid": "media-player" }),
}));
/* ConfidentVoicePractice is gone (§3) — the exercise is a STEP now, drawn by
   the sheet, so there is nothing to mock. The real offer card carries the
   data-testid the practice assertions look for. */
vi.mock("@/services/api/mlc3FirstClient", async (load) => {
  const actual = await load<typeof import("@/services/api/mlc3FirstClient")>();
  return { ...actual, mlc3FirstClientPresentationEnabled: () => false };
});
vi.mock("@/services/api/takeFeedback", () => ({
  saveTakeFeedbackResponse: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));

const TEXT =
  "We should ship it now because the data is clear and the team is ready.";

function suggestion(over: Partial<DocumentSuggestion>): DocumentSuggestion {
  return {
    id: "s-base",
    start: 0,
    end: 22,
    quote: "We should ship it now",
    kind: "advice",
    proposedText: null,
    device: null,
    ...over,
  } as DocumentSuggestion;
}

const confidentVoice = suggestion({
  id: "s-cv",
  feedbackFamily: "confident_voice",
  source: "confident_voice",
  snippetId: "snip-1",
  takeSessionId: "take-1",
  tentative: true,
  // numeric-looking fields a careless render might print
  confidence: 0.83,
  score: 7,
} as Partial<DocumentSuggestion>);

const rewrite = suggestion({
  id: "s-rw",
  feedbackFamily: "rewrite_clarity",
  kind: "replace",
  start: 23,
  end: 47,
  quote: "because the data is clear",
  proposedText: "because the numbers back it",
  takeSessionId: "take-1",
});

const praise = suggestion({
  id: "s-pr",
  feedbackFamily: "great_formulation",
  device: "impeccable",
  start: 52,
  end: 70,
  quote: "the team is ready",
  cueKeys: ["steady_pace"],
  takeSessionId: "take-1",
} as Partial<DocumentSuggestion>);

const inventory = [confidentVoice, rewrite, praise];

function chunk(): DeckChunk {
  return {
    part: { id: "p1", text: TEXT, locked: false },
    paragraphIndex: 0,
    start: 0,
    end: TEXT.length,
    status: "waiting",
    pendingIds: inventory.map((s) => s.id),
    approvedIds: [],
  } as DeckChunk;
}

const noop = async () => true;
const props = {
  onAccept: vi.fn(noop),
  onKeepMine: vi.fn(noop),
  // Typed so the mock records its argument, for the same reason
  // onSetRootPhrase is: the bold-on-tap test reads the TEXT that was locked,
  // not merely that a lock happened.
  onLockIn: vi.fn(async (_text: string) => ({
    outcome: "ok" as const,
    rootPhraseProposal: null,
  })),
  onKeepEvolving: vi.fn(async () => "ok" as const),
  // Typed so the mock records its argument: the promotion test needs to read
  // the span that was stored, not merely that something was.
  onSetRootPhrase: vi.fn(async (_phrase: RootPhraseSpan | null) => true),
  onClose: vi.fn(),
};

/** AC-9: what a user must never read on this surface. */
const SCORE_LIKE = [
  /\b\d+(\.\d+)?\s*%/, // 83%
  /\b\d+\s*\/\s*\d+\b/, // 7/10
  /\b\d\.\d{2}\b/, // 0.83
  /\bscore\b/i,
  /\bverdict\b/i,
  /\bconfidence (level|index|rating)\b/i,
  /\bclassif/i,
];

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function buttonLabels(): string[] {
  // Text first, then aria-label — an icon-only button (the Edit myself pencil)
  // has an EMPTY textContent, not a null one, so `??` would never reach the
  // label and the decision would read as unnamed.
  return Array.from(container.querySelectorAll("button")).map((b) => {
    const text = (b.textContent ?? "").trim();
    return text || (b.getAttribute("aria-label") ?? "").trim();
  });
}

/** Click the button carrying exactly this label, and flush what it starts.
 *
 *  The sheet's TITLE is itself a button (it doubles as the drag grabber), so
 *  on the lock step there are two elements reading "Lock" and the naive match
 *  hits the grabber — which toggles the detent and decides nothing. Skipping
 *  the grabber is the difference between testing the pill and testing the
 *  sheet's height.
 */
async function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (b) =>
      (b.textContent ?? "").trim() === label &&
      !b.hasAttribute("data-sheet-grabber"),
  );
  if (!button) throw new Error(`no button labelled "${label}"`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** Open the sheet on ONE lane.
 *
 *  Since 2026-09-15 the ladder sorts confidence to the front whatever the
 *  payload order, so seeding the whole inventory and expecting to land on the
 *  rewrite screen no longer works — and should not. A per-lane test therefore
 *  hands the sheet exactly the item it is about; ordering has its own test
 *  below, with the whole inventory. */
async function render(initial: DocumentSuggestion) {
  await act(async () => {
    root.render(
      createElement(DeckChunkModal, {
        ...props,
        state: chunkStateFor(
          { ...chunk(), pendingIds: [initial.id] } as DeckChunk,
          { document: TEXT, suggestions: [initial] },
        ),
      }),
    );
  });
  return container.textContent ?? "";
}

describe("DeckChunkModal — F1 net", () => {
  it.each([
    ["confident voice", confidentVoice],
    ["rewrite", rewrite],
    ["praise", praise],
  ])("AC-9: the %s face renders no score, ratio, percentage or verdict", async (_name, item) => {
    const text = await render(item);
    expect(text.length).toBeGreaterThan(20);
    for (const pattern of SCORE_LIKE) {
      expect(text, `matched ${pattern}`).not.toMatch(pattern);
    }
  });

  it("the Confident Voice lane asks the one qualitative question, with words not numbers", async () => {
    const text = await render(confidentVoice);
    expect(text).toContain("Does this sound confident to you?");
    const labels = buttonLabels();
    for (const answer of ["Yes — Confident", "In-between", "No — Not confident", "Not sure", "Audio unclear"]) {
      expect(labels).toContain(answer);
    }
  });

  it("the rewrite lane shows the exact words and the clearer version, and keeps the user's wording available", async () => {
    const text = await render(rewrite);
    expect(text).toContain("What you said");
    expect(text).toContain(rewrite.quote);
    expect(text).toContain("Clearer version");
    expect(text).toContain(rewrite.proposedText!);
    const labels = buttonLabels();
    // One pill, the verb of this screen. "Edit myself" is the pencil on the
    // Clearer version card, named for assistive tech by its aria-label.
    expect(labels).toContain("Apply");
    expect(labels).toContain("Edit myself");
    expect(labels).toContain("Keep wording");
    // Never two buttons side by side: the decline is a grey link under the
    // pill, and there is no third competing action.
    expect(labels).not.toContain("Apply suggestion");
  });

  it("the praise lane is read, not rated: one Continue and nothing to weigh", async () => {
    // Founder 2026-09-15. A black CTA on a question about your own praise
    // does not merely bias the answer — it makes disagreeing feel like
    // refusing. So the rating is gone and the screen is titled Good job.
    const text = await render(praise);
    expect(text).toContain("Good job");
    expect(text).toContain(praise.quote);
    expect(text).toContain("You said this one really well.");
    const labels = buttonLabels();
    expect(labels).toContain("Continue");
    for (const gone of ["Useful", "Not useful", "Apply", "Keep wording"]) {
      expect(labels, gone).not.toContain(gone);
    }
  });

  it("Continue still WRITES, or praise is offered again forever", async () => {
    // The rating was what marked the item decided. Removing it without
    // replacing the write would re-offer this praise every time the paragraph
    // is opened — so Continue records an acknowledgement instead of a verdict.
    const { saveTakeFeedbackResponse } = await import(
      "@/services/api/takeFeedback"
    );
    const saved = vi.mocked(saveTakeFeedbackResponse);
    saved.mockClear();
    await render(praise);
    await click("Continue");
    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved.mock.calls[0][0].response).toBe("acknowledged");
    expect(saved.mock.calls[0][0].feedbackId).toBe(praise.id);
  });

  /* ------------------------------------------------------------------ */
  /*  ONE AT A TIME (founder 2026-09-15)                                  */
  /*                                                                     */
  /*  These two replace "every Manager lane is listed up front" and the   */
  /*  chip-counting version of the budget test. The founder saw the       */
  /*  three-chip inventory on the Confident Voice card and reversed the   */
  /*  earlier rule: "only one feedback at a time … so that the screen is  */
  /*  clean". The L2 budget itself did not change, so it is still pinned  */
  /*  here — but through the rule it actually encodes (a chunk can ask    */
  /*  for at most three decisions) rather than through a list widget that */
  /*  no longer exists.                                                   */
  /* ------------------------------------------------------------------ */

  it("shows one feedback at a time, never the queue behind it", async () => {
    const text = await render(confidentVoice);
    // The item under review is fully present...
    expect(text).toContain("Does this sound confident to you?");
    // ...and the two still queued behind it are named nowhere on screen.
    expect(text).not.toContain("Possible clarity improvement");
    expect(text).not.toContain("Possible strong formulation");
    expect(text).not.toContain("Feedback ready");
    expect(buttonLabels().filter((l) => /^\d+\. /.test(l))).toHaveLength(0);
  });

  it("the Confident Voice face names no verdict above the question", async () => {
    const text = await render(confidentVoice);
    // One plain word where the kind eyebrow and "Suggested change" used to be.
    // The machine's read must not be announced over a question whose entire
    // value is the speaker's own, independently formed answer.
    expect(container.querySelector("h2")?.textContent?.trim()).toBe("Feedback");
    expect(text).not.toContain("Possible confident moment");
    expect(text).not.toContain("Suggested change");
  });

  it("a fourth candidate is never reachable, however far you walk (L2 budget)", async () => {
    const extra = suggestion({
      id: "s-4",
      feedbackFamily: "rewrite_clarity",
      kind: "replace",
      quote: "ship it now",
      // Distinctive on purpose: if the cap leaks, this string shows up.
      proposedText: "FOURTH-LANE-SHOULD-BE-UNREACHABLE",
      takeSessionId: "take-1",
    });
    await act(async () => {
      root.render(
        createElement(DeckChunkModal, {
          ...props,
          state: {
            ...chunkStateFor(
              { ...chunk(), pendingIds: [...inventory, extra].map((s) => s.id) } as DeckChunk,
              { document: TEXT, suggestions: [...inventory, extra] },
            ),
            // Past the model's own cap on purpose: the modal must cap too.
            pending: [...inventory, extra],
          },
        }),
      );
    });

    // Walk the whole ladder by deciding whatever is on screen. The walk
    // doubles as proof that the queue advances on its own, which is the only
    // route between steps now.
    const decided: string[] = [];
    for (let step = 0; step < 6; step += 1) {
      const text = container.textContent ?? "";
      if (text.includes("Does this sound confident to you?")) {
        decided.push("confident_voice");
        // Answering IS the decision — no Done step behind it (2026-09-15).
        await click("Yes — Confident");
      } else if (text.includes("Clearer version")) {
        decided.push("rewrite_clarity");
        await click("Keep wording");
      } else if (text.includes("You said this one really well.")) {
        decided.push("great_formulation");
        await click("Continue");
      } else {
        break;
      }
    }

    expect(decided).toEqual([
      "confident_voice",
      "rewrite_clarity",
      "great_formulation",
    ]);
    expect(container.textContent).not.toContain(
      "FOURTH-LANE-SHOULD-BE-UNREACHABLE",
    );
  });

  it("answering is the whole decision: no Done step, and one write", async () => {
    // Founder 2026-09-15: "drop the Done step". The screen behind it held a
    // thank-you and a button whose only job was to admit it — and that button
    // re-posted the SAME answer for the same item, so the tap cost a screen
    // and bought a duplicate write.
    const { saveTakeFeedbackResponse } = await import(
      "@/services/api/takeFeedback"
    );
    const saved = vi.mocked(saveTakeFeedbackResponse);
    saved.mockClear();

    await render(confidentVoice);
    await click("Yes — Confident");

    expect(buttonLabels()).not.toContain("Done");
    expect(container.textContent).not.toContain("Thanks");
    // Exactly one response filed for the clip that was rated.
    const forThisClip = saved.mock.calls.filter(
      ([arg]) => arg.feedbackId === confidentVoice.id,
    );
    expect(forThisClip).toHaveLength(1);
    expect(forThisClip[0][0].response).toBe("yes");
  });

  it("answers into the exercise step, which is now its own screen", async () => {
    // INVERTED on purpose (founder 2026-09-16, §3). The offer used to stop the
    // advance, because a card nested under the answered confidence screen was
    // the only place it could live. It has its own step now, so the answer
    // advances INTO it — the journey is kept by giving it a screen rather than
    // by refusing to leave the previous one.
    const withPractice = suggestion({
      id: "s-cv-practice",
      feedbackFamily: "confident_voice",
      source: "confident_voice",
      snippetId: "snip-9",
      takeSessionId: "take-1",
      practiceExercise: { id: "ex-1" },
      evidence: {
        projectId: "arc-1",
        takeSessionId: "take-1",
        slideIndex: 0,
        paragraphIndex: 0,
        start: 0,
        end: 21,
      },
    } as unknown as Partial<DocumentSuggestion>);
    const pair = [withPractice, rewrite];
    await act(async () => {
      root.render(
        createElement(DeckChunkModal, {
          ...props,
          state: chunkStateFor(
            { ...chunk(), pendingIds: pair.map((s) => s.id) } as DeckChunk,
            { document: TEXT, suggestions: pair },
          ),
        }),
      );
    });

    // The order is enforced: judgement, then the remaining feedback, THEN the
    // exercise (§1). So the answer lands on the rewrite, and the exercise is
    // the screen after it — not a card riding on the confidence screen.
    await click("No — Not confident");
    expect(container.textContent).toContain("Clearer version");
    expect(container.querySelector('[data-testid="practice-offer"]')).toBeNull();

    await click("Keep wording");
    expect(container.querySelector('[data-testid="practice-offer"]')).not.toBeNull();
    // The exercise step's own footer: one verb, one stacked link.
    expect(buttonLabels()).toContain("Practise");
    expect(buttonLabels()).toContain("Not now");
    // Offered on a No, because the practice is matched to the clip rather than
    // awarded for a verdict.
  });

  it("never carries one clip's answer onto the next clip (L3)", async () => {
    // The Confident Voice answer is per ITEM. When it did not reset on
    // advance, a second confident-voice item on the same chunk opened already
    // answered — thank-you copy over a clip nobody rated — and since Done
    // posts `agreeValue ?? "not_sure"`, tapping it filed the PREVIOUS clip's
    // owner answer against this one. That is a provenance breach, not a
    // cosmetic slip. Ordinary under the V3 policy, which returns one Confident
    // Voice item per 75-word block, not one per Take.
    const second = suggestion({
      id: "s-cv2",
      feedbackFamily: "confident_voice",
      source: "confident_voice",
      snippetId: "snip-2",
      takeSessionId: "take-1",
      start: 52,
      end: 70,
      quote: "the team is ready",
    } as Partial<DocumentSuggestion>);
    const pair = [confidentVoice, second];
    await act(async () => {
      root.render(
        createElement(DeckChunkModal, {
          ...props,
          state: chunkStateFor(
            { ...chunk(), pendingIds: pair.map((s) => s.id) } as DeckChunk,
            { document: TEXT, suggestions: pair },
          ),
        }),
      );
    });

    const { saveTakeFeedbackResponse } = await import(
      "@/services/api/takeFeedback"
    );
    const saved = vi.mocked(saveTakeFeedbackResponse);
    saved.mockClear();

    // One tap: the answer saves and advances, with no Done step between.
    await click("Yes — Confident");

    // The second item must be ASKING, not thanking.
    expect(container.textContent).toContain("Does this sound confident to you?");
    expect(buttonLabels()).toContain("Yes — Confident");

    // And nothing may have been filed against the second clip yet. Every write
    // so far belongs to the clip the speaker actually rated.
    const ratedIds = saved.mock.calls.map(([arg]) => arg.feedbackId);
    expect(ratedIds).not.toContain(second.id);
    expect(new Set(ratedIds)).toEqual(new Set([confidentVoice.id]));
  });
});

/* -------------------------------------------------------------------------- */
/*  THE LADDER (founder 2026-09-15)                                            */
/*                                                                            */
/*  One decision per screen, ending at the lock. These cover the four          */
/*  behaviours the handoff named, each of which is a thing that would fail     */
/*  silently: an order inherited from the payload, a phrase asked for twice, a */
/*  Skip that quietly becomes an anchor, and a Discard that dismisses the      */
/*  sheet instead of opening the editor.                                      */
/* -------------------------------------------------------------------------- */

const emphasis = suggestion({
  id: "s-style",
  feedbackFamily: "rewrite_clarity",
  kind: "bold",
  quote: "the team is ready",
  takeSessionId: "take-1",
});

async function renderLadder(over: Record<string, unknown> = {}) {
  await act(async () => {
    root.render(
      createElement(DeckChunkModal, {
        ...props,
        state: {
          ...chunkStateFor(
            { ...chunk(), pendingIds: inventory.map((s) => s.id) } as DeckChunk,
            { document: TEXT, suggestions: inventory },
          ),
          ...over,
        },
      }),
    );
  });
}

describe("the ladder", () => {
  it("asks the confidence question first, whatever order the payload used", async () => {
    // The payload here lists the rewrite first. Confidence is a judgement
    // about the speaker's own delivery; asking it after a rewrite proposal
    // makes them judge a recording they have just been told to change.
    await act(async () => {
      root.render(
        createElement(DeckChunkModal, {
          ...props,
          state: chunkStateFor(
            { ...chunk(), pendingIds: [rewrite.id, confidentVoice.id] } as DeckChunk,
            { document: TEXT, suggestions: [rewrite, confidentVoice] },
          ),
        }),
      );
    });
    expect(container.textContent).toContain("Does this sound confident to you?");
    expect(container.textContent).not.toContain("Clearer version");
  });

  it("walks to the emphasis step and promotes the phrase on lock, with no root face", async () => {
    vi.mocked(props.onSetRootPhrase).mockClear();
    await renderLadder({ style: emphasis });
    await click("Yes — Confident");     // feedback
    await click("Keep wording");        // suggestion
    await click("Continue");            // good job
    expect(container.textContent).toContain("With emphasis");
    await click("Use this phrase");
    // The lock step, and it is the LAST one: no rooting-phrase screen behind
    // it. They already said which words matter.
    expect(container.textContent).not.toContain("Tap the words");
    await click("Lock");
    expect(props.onLockIn).toHaveBeenCalled();
    const calls = vi.mocked(props.onSetRootPhrase).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]?.text).toContain("the team is ready");
    expect(props.onClose).toHaveBeenCalled();
  });

  it("saves the emphasis on a CONFIDENCE-ONLY paragraph", async () => {
    // REPORTED FROM REAL USE 2026-09-16: "I tap to choose the emphasis words,
    // I click lock, and it doesn't save."
    //
    // The lock gate read `agreeValue`, which is the CHIP's state, and
    // advanceStep clears it on every step (deliberately — a second
    // confident-voice item must open unanswered, L3). So by Lock it was always
    // null, `agreeValue !== "yes"` was always true, and on a paragraph whose
    // ONLY feedback was the confidence question the anchor was nulled and
    // onSetRootPhrase never fired.
    //
    // The test above did not catch it because its inventory also carries a
    // rewrite and a praise item, so `confidenceOnly` is false and the broken
    // branch is never reached. This one is the founder's actual case.
    vi.mocked(props.onSetRootPhrase).mockClear();
    await renderLadder({ style: emphasis, pending: [confidentVoice] });
    await click("Yes — Confident");
    expect(container.textContent).toContain("With emphasis");
    await click("Use this phrase");
    await click("Lock");
    expect(props.onLockIn).toHaveBeenCalled();
    const calls = vi.mocked(props.onSetRootPhrase).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]?.text).toContain("the team is ready");
  });

  it("tapping your own words previews them at once WITHOUT editing the document", async () => {
    // BOTH HALVES OF A REVERSAL, pinned together (founder 2026-09-16).
    //
    // The ask was "tap to bold immediately", and the asymmetry behind it is
    // real: accepting the PROPOSED phrase changes the words on screen, while
    // choosing your own used to leave them plain. My first fix wrote
    // `{{orange:…}}` into the draft so Lock would carry it — and that loses
    // the speaker's work. A paragraph carrying a marker cannot be edited: the
    // typed words are in the editor and absent from the save.
    //
    // So the preview is the answer, not the edit. The tapped word turns accent
    // the instant it is tapped (first expectation) — the same colour a rooting
    // phrase has while recording — and the words travel to the server as a
    // SPAN through onSetRootPhrase, which is where §5 puts them. The locked
    // text is byte-identical to what the speaker was reading (second).
    vi.mocked(props.onLockIn).mockClear();
    vi.mocked(props.onSetRootPhrase).mockClear();
    await renderLadder({ style: emphasis, pending: [confidentVoice] });
    await click("Yes — Confident");
    await click("Choose different words");
    const word = Array.from(container.querySelectorAll("button")).find(
      (b) => (b.textContent ?? "").trim() === "ready.",
    )!;
    await act(async () => {
      word.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    // Immediate, on the spot, before anything is committed.
    expect(word.getAttribute("aria-pressed")).toBe("true");
    expect(word.className).toContain("text-primary");

    await click("Use this phrase");
    await click("Lock");
    const lockedText = vi.mocked(props.onLockIn).mock.calls[0][0];
    expect(lockedText).not.toContain("{{orange:");
    expect(lockedText).not.toContain("**");
    // ...and the words still land, as the anchor.
    const calls = vi.mocked(props.onSetRootPhrase).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]?.text).toContain("ready.");
  });

  it("a judgement that was not Yes skips step four entirely", async () => {
    // THE GATE, replacing the Skip button that used to carry this (founder
    // 2026-09-16, §5: the step has no opt-out). Orange means "I confirmed I
    // deliver this well", so anything other than a Yes must not reach the
    // screen that offers it — and a paragraph without an orange phrase is one
    // that never got there, not one that declined.
    vi.mocked(props.onSetRootPhrase).mockClear();
    await renderLadder({ style: emphasis });
    await click("No — Not confident");
    await click("Keep wording");
    await click("Continue");
    // Straight to Lock: no emphasis screen, and therefore no Skip to press.
    expect(container.textContent).not.toContain("With emphasis");
    expect(buttonLabels()).not.toContain("Use this phrase");
    await click("Lock");
    expect(props.onLockIn).toHaveBeenCalled();
    expect(props.onSetRootPhrase).not.toHaveBeenCalled();
  });

  it("a paragraph never judged at all also skips it", async () => {
    // The common case, and the one the founder called out: a paragraph the
    // detector never flagged is never judged, so MOST paragraphs reach Lock
    // with no orange. That is the intended shape, not a gap.
    vi.mocked(props.onSetRootPhrase).mockClear();
    await renderLadder({ style: emphasis, pending: [] });
    expect(container.textContent).not.toContain("With emphasis");
    expect(buttonLabels()).not.toContain("Use this phrase");
    await click("Lock");
    expect(props.onLockIn).toHaveBeenCalled();
    expect(props.onSetRootPhrase).not.toHaveBeenCalled();
  });

  it("Choose different words opens tap-to-select, and a tap previews in the accent", async () => {
    await renderLadder({ style: emphasis });
    await click("Yes — Confident");
    await click("Keep wording");
    await click("Continue");
    await click("Choose different words");
    expect(container.textContent).toContain("Tap the words");
    const word = Array.from(container.querySelectorAll("button")).find(
      (b) => (b.textContent ?? "").trim() === "ready.",
    )!;
    expect(word).toBeTruthy();
    await act(async () => {
      word.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(word.getAttribute("aria-pressed")).toBe("true");
    // --primary, because that is how a rooting phrase renders while
    // recording. A preview, not a selection colour.
    expect(word.className).toContain("text-primary");
  });

  it("Discard lands on the editor rather than dismissing the sheet", async () => {
    // It used to call onClose(), so undoing a lock also closed the sheet: the
    // speaker asked to edit and was put back where they started, with the
    // paragraph now unlocked and nothing on screen saying so.
    const onUnlockPart = vi.fn(async () => "ok" as const);
    vi.mocked(props.onClose).mockClear();
    await act(async () => {
      root.render(
        createElement(DeckChunkModal, {
          ...props,
          onUnlockPart,
          state: chunkStateFor(
            {
              ...chunk(),
              part: { id: "p1", text: TEXT, locked: true },
              status: "locked",
              pendingIds: [],
            } as unknown as DeckChunk,
            { document: TEXT, suggestions: [] },
          ),
        }),
      );
    });
    expect(buttonLabels()).toContain("Discard");
    await click("Discard");
    expect(onUnlockPart).toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(buttonLabels()).toContain("Lock");
  });
});
