import { describe, expect, it } from "vitest";

import {
  opensRootPhrase,
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
    expect(stepTitle("emphasis", false)).toBe("Emphasis");
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

/* ── WHO MAY ROOT A PHRASE (founder 2026-09-22) ───────────────────────────
 * "maybe do not restrict the tap to the YES answer only ... cause people
 * usually will hate their voice and not consider it confident, so gate
 * keeping it at YES will delay by several takes to get the rooting phrases."
 *
 * Contract 24e already made the tap-to-root step part of every item. These
 * pin the one exception and, just as importantly, that the step and the store
 * read the same rule — a screen offered but not saved is silent data loss. */
describe("opensRootPhrase — every answer but one", () => {
  it("opens for every answer that judged the delivery", () => {
    for (const answer of ["yes", "in_between", "no", "not_sure"] as const) {
      expect(opensRootPhrase(answer)).toBe(true);
    }
  });

  it("stays closed when the clip could not be heard", () => {
    // Not a harsh judgement — no judgement. Choosing which words to land on
    // is not answerable by someone who could not make the words out.
    expect(opensRootPhrase("audio_unclear")).toBe(false);
  });

  it("stays closed until something is answered at all", () => {
    // A paragraph the detector never flagged reaches Lock with no orange.
    expect(opensRootPhrase(null)).toBe(false);
  });

  it("opens for the coarse answer the older paths can express", () => {
    // The legacy agreement chip and the exercise's closing yes/no carry only
    // these two; neither can mean "audio unclear", so both open.
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
    expect(ask("no")).toBe(true);
    expect(ask("audio_unclear")).toBe(false);
  });
});

