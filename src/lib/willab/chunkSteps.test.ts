import { describe, expect, it } from "vitest";

import {
  opensRootPhrase,
  closesLock,
  buildChunkSteps,
  orderedInventory,
  stepKindFor,
  stepProgress,
  stepTitle,
  locksAsPreview,
} from "./chunkSteps";
import type { DocumentSuggestion } from "@/services/api/idealText";

function item(over: Partial<DocumentSuggestion>): DocumentSuggestion {
  return {
    id: "s",
    start: 0,
    end: 4,
    quote: "word",
    kind: "advice",
    proposedText: null,
    device: null,
    ...over,
  } as DocumentSuggestion;
}

const confidence = item({
  id: "cv",
  feedbackFamily: "confident_voice",
  source: "confident_voice",
} as Partial<DocumentSuggestion>);
const rewrite = item({ id: "rw", feedbackFamily: "rewrite_clarity", kind: "replace" });
const praise = item({
  id: "pr",
  feedbackFamily: "great_formulation",
  device: "impeccable",
} as Partial<DocumentSuggestion>);

describe("which screen an item gets", () => {
  it("routes each family to its own face", () => {
    expect(stepKindFor(confidence)).toBe("feedback");
    expect(stepKindFor(praise)).toBe("praise");
    expect(stepKindFor(rewrite)).toBe("suggestion");
  });

  it("recognises confident voice by source as well as family", () => {
    // The wire sends it as kind 'bold' with source set, so a family-only check
    // would drop it into the rewrite face and ask the wrong question.
    expect(stepKindFor(item({ kind: "bold", source: "confident_voice" }))).toBe(
      "feedback",
    );
  });

  it("recognises praise by device as well as family", () => {
    expect(stepKindFor(item({ device: "impeccable" }))).toBe("praise");
  });
});

describe("order is enforced, not inherited", () => {
  it("asks the confidence question first however the payload arrived", () => {
    // THE REASON: confidence is a judgement about the speaker's own delivery.
    // Asking it after a rewrite proposal makes them judge a recording they
    // have just been told to change.
    const served = [rewrite, praise, confidence];
    expect(orderedInventory(served).map((s) => s.id)).toEqual([
      "cv", "rw", "pr",
    ]);
  });

  it("leaves everything else in the order the Manager served (L2)", () => {
    const served = [praise, rewrite];
    expect(orderedInventory(served).map((s) => s.id)).toEqual(["pr", "rw"]);
  });

  it("is stable with several confidence items", () => {
    const second = item({ id: "cv2", feedbackFamily: "confident_voice" });
    expect(
      orderedInventory([rewrite, confidence, second]).map((s) => s.id),
    ).toEqual(["cv", "cv2", "rw"]);
  });
});

describe("the ladder", () => {
  it("ends at the lock, always", () => {
    const steps = buildChunkSteps({ inventory: [], canEmphasise: false });
    expect(steps.map((s) => s.kind)).toEqual(["lock"]);
  });

  it("puts the emphasis offer between the feedback and the lock", () => {
    // It used to live inside the editor, sharing a footer with Lock — two
    // decisions in one footer.
    const steps = buildChunkSteps({
      inventory: [rewrite, confidence],
      canEmphasise: true,
    });
    expect(steps.map((s) => s.kind)).toEqual([
      "feedback", "suggestion", "emphasis", "lock",
    ]);
  });

  it("omits the emphasis step when there is nothing to emphasise", () => {
    const steps = buildChunkSteps({
      inventory: [praise],
      canEmphasise: false,
    });
    expect(steps.map((s) => s.kind)).toEqual(["praise", "lock"]);
  });

  it("adds the service exercise rung only when the server allowed one", () => {
    const allowed = buildChunkSteps({
      inventory: [confidence],
      canPractiseService: true,
      canEmphasise: true,
    });
    expect(allowed.map((s) => s.id)).toEqual([
      "cv", "service_exercise", "emphasis", "lock",
    ]);
    const refused = buildChunkSteps({
      inventory: [confidence],
      canPractiseService: false,
      canEmphasise: true,
    });
    expect(refused.map((s) => s.kind)).toEqual(["feedback", "emphasis", "lock"]);
  });

  it("never holds two exercise rungs (24f: one exercise per Take)", () => {
    const both = buildChunkSteps({
      inventory: [confidence],
      canPractise: true,
      canPractiseService: true,
      canEmphasise: false,
    });
    expect(both.filter((s) => s.kind === "exercise").map((s) => s.id)).toEqual([
      "exercise",
    ]);
  });

  it("gives the two founder paths four steps each", () => {
    const suggestionPath = buildChunkSteps({
      inventory: [confidence, rewrite],
      canEmphasise: true,
    });
    const praisePath = buildChunkSteps({
      inventory: [confidence, praise],
      canEmphasise: true,
    });
    expect(suggestionPath).toHaveLength(4);
    expect(praisePath).toHaveLength(4);
  });
});

describe("titles", () => {
  it("names each screen after its own decision", () => {
    expect(stepTitle("feedback", false)).toBe("Feedback");
    expect(stepTitle("suggestion", false)).toBe("Suggestion");
    expect(stepTitle("praise", false)).toBe("Good job");
    expect(stepTitle("emphasis", false)).toBe("Choose your helper words");
    expect(stepTitle("lock", false)).toBe("Lock");
  });

  it("calls the lock step 'Edit this chunk' when nothing was pending", () => {
    // Reopening a clean paragraph is an edit, not the end of a review.
    expect(stepTitle("lock", true)).toBe("Edit this chunk");
  });
});

describe("the step bar counts screens and nothing else (AC-9)", () => {
  const steps = buildChunkSteps({
    inventory: [confidence, rewrite],
    canEmphasise: true,
  });

  it("reports position by step, not by severity", () => {
    expect(stepProgress(steps, "cv")).toEqual({ total: 4, current: 0 });
    expect(stepProgress(steps, "emphasis")).toEqual({ total: 4, current: 2 });
    expect(stepProgress(steps, "lock")).toEqual({ total: 4, current: 3 });
  });

  it("falls back to the first segment rather than guessing", () => {
    expect(stepProgress(steps, null)).toEqual({ total: 4, current: 0 });
    expect(stepProgress(steps, "nope")).toEqual({ total: 4, current: 0 });
  });

  it("always counts the lock, so the total is never a problem count", () => {
    // A paragraph with nothing pending still has one segment. If the total
    // tracked findings, a four-segment bar beside a three-segment bar would
    // say which paragraph was worse — out loud, in a column.
    expect(stepProgress(buildChunkSteps({
      inventory: [], canEmphasise: false,
    }), "lock").total).toBe(1);
    expect(stepProgress(buildChunkSteps({
      inventory: [praise], canEmphasise: false,
    }), "lock").total).toBe(2);
  });
});


describe("locksAsPreview — you see what you are committing", () => {
  /* Founder 2026-09-17: "on the lock-in screen show the whole text that is
     being locked in WITH the boldening and orange that was tapped in the step
     earlier." The step drew a plain editor, so the phrase just chosen was
     invisible at the exact moment it was being committed. */
  it("shows, rather than offers an editor, once a phrase has been chosen", () => {
    expect(locksAsPreview({
      locked: false, hadFeedback: true, chosenPhrase: "these words",
    })).toBe(true);
  });

  it("still shows a settled paragraph that had nothing waiting", () => {
    expect(locksAsPreview({
      locked: true, hadFeedback: false, chosenPhrase: null,
    })).toBe(true);
  });

  it("still OFFERS THE EDITOR everywhere else — editing stays reachable", () => {
    expect(locksAsPreview({
      locked: false, hadFeedback: true, chosenPhrase: null,
    })).toBe(false);
    expect(locksAsPreview({
      locked: false, hadFeedback: false, chosenPhrase: null,
    })).toBe(false);
    // A locked paragraph that DID have feedback keeps its editor, unchanged.
    expect(locksAsPreview({
      locked: true, hadFeedback: true, chosenPhrase: null,
    })).toBe(false);
  });

  it("an empty phrase is no phrase", () => {
    expect(locksAsPreview({
      locked: false, hadFeedback: true, chosenPhrase: "",
    })).toBe(false);
  });
});

describe("judgedStatus — the status the server serves for an answered row", () => {
  it("a Yes keeps the ladder open; every other answer closes the item", async () => {
    const { judgedStatus } = await import("./chunkSteps");
    expect(judgedStatus("yes")).toBe("approved");
    expect(judgedStatus("other")).toBe("dismissed");
  });
});

/* ── WHO MAY ROOT A PHRASE (founder 2026-09-22, finished 2026-09-24) ──────
 * "maybe do not restrict the tap to the YES answer only ... cause people
 * usually will hate their voice and not consider it confident, so gate
 * keeping it at YES will delay by several takes to get the rooting phrases."
 *
 * The 09-22 ruling left one carve-out — "Audio unclear" — on the reasoning
 * that someone who could not hear the clip cannot choose which words to land
 * on. Shown that case on the real screen and asked directly, the founder
 * ruled the other way on 09-24: "keep the emphasis open". These tests are
 * rewritten to the answer he gave rather than deleted, so the reversal is
 * legible to whoever reads them next.
 *
 * What still matters most is the second half: the step and the store read the
 * SAME rule. A screen offered but not saved is silent data loss. */
describe("opensRootPhrase — Yes, In-between and Not sure (founder 2026-09-25)", () => {
  it("opens for the three answers that go on to Lock", () => {
    for (const answer of ["yes", "in_between", "not_sure"] as const) {
      expect(opensRootPhrase(answer)).toBe(true);
    }
  });

  it("stays closed on No and Audio unclear: the sheet closes after the feedback", () => {
    // Reverses 2026-09-24's "keep the emphasis open". A practice judged Yes,
    // In-between or Not sure afterwards supersedes this answer (29a).
    expect(opensRootPhrase("no")).toBe(false);
    expect(opensRootPhrase("audio_unclear")).toBe(false);
  });

  it("stays closed until something is answered at all", () => {
    expect(opensRootPhrase(null)).toBe(false);
  });

  it("opens for the coarse answer the older paths can express", () => {
    expect(opensRootPhrase("yes")).toBe(true);
    expect(opensRootPhrase("other")).toBe(true);
  });

  it("is what the ladder asks, so the screen and the store cannot disagree", () => {
    const ask = (answer: Parameters<typeof opensRootPhrase>[0]) =>
      buildChunkSteps({
        inventory: [],
        canEmphasise: opensRootPhrase(answer),
      }).some((step) => step.kind === "emphasis");
    expect(ask("not_sure")).toBe(true);
    expect(ask("in_between")).toBe(true);
    expect(ask("no")).toBe(false);
    expect(ask("audio_unclear")).toBe(false);
    expect(ask(null)).toBe(false);
  });
});

/* ── WHICH ANSWERS TAKE THE LOCK AWAY (founder 2026-09-24) ────────────────
 * "when there is an answer that no, not confident or not sure, do not give
 * the people option to lock it in ... and the same for audio unclear." Then,
 * on a draft that merely demoted Lock to Keep evolving: "no just don't show
 * that overlay; no keep evolving — after the rooting phrases close the
 * overlay in these cases."
 *
 * The distinction these pin is the one a collapsed yes/other answer cannot
 * express at all: "No" and "In-between" fall on opposite sides of it. */
describe("closesLock — No and Audio unclear end the ladder early", () => {
  it("closes on No and Audio unclear", () => {
    expect(closesLock("no")).toBe(true);
    expect(closesLock("audio_unclear")).toBe(true);
  });

  it("Not sure keeps its Lock (founder 2026-09-25, Q1 B)", () => {
    expect(closesLock("not_sure")).toBe(false);
  });

  it("In-between keeps its Lock", () => {
    // Founder, asked directly the same day. Someone who thought it was
    // middling still thought something about the words; a No, a shrug and a
    // dead mic are the three that say this is not the delivery to freeze.
    expect(closesLock("in_between")).toBe(false);
  });

  it("Yes, the coarse answer, and no answer at all keep it", () => {
    expect(closesLock("yes")).toBe(false);
    // The exercise's closing judgement is about the PRACTICE recording, not
    // this one, so it does not carry the founder's rule about this one.
    expect(closesLock("other")).toBe(false);
    // A paragraph nobody judged is untouched by any of this.
    expect(closesLock(null)).toBe(false);
  });

  it("takes the step off the end rather than disabling it", () => {
    const ladder = (answer: Parameters<typeof closesLock>[0]) =>
      buildChunkSteps({
        inventory: [],
        canEmphasise: opensRootPhrase(answer),
        canLock: !closesLock(answer),
      }).map((step) => step.kind);
    expect(ladder("yes")).toContain("lock");
    expect(ladder("in_between")).toContain("lock");
    expect(ladder("no")).not.toContain("lock");
    expect(ladder("audio_unclear")).not.toContain("lock");
  });

  it("an older caller that passes no canLock keeps the lock", () => {
    // Safe-ahead: the flag defaults to true, so nothing that has not been
    // taught the rule loses a step.
    expect(
      buildChunkSteps({ inventory: [], canEmphasise: false }).map((s) => s.kind),
    ).toEqual(["lock"]);
  });

  it("never returns an empty ladder", () => {
    // THE INVARIANT THAT REPLACES "the lock is always present". The sheet
    // renders `steps[current]` and would have nothing to draw. It holds
    // structurally: canLock is only false once an answer exists, an answer
    // only exists once a Confident Voice item has been answered, and that
    // item is itself a step in this list.
    for (const answer of ["no", "not_sure", "audio_unclear"] as const) {
      const steps = buildChunkSteps({
        inventory: [confidence],
        canEmphasise: opensRootPhrase(answer),
        canLock: !closesLock(answer),
      });
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[0].kind).toBe("feedback");
    }
  });
});
