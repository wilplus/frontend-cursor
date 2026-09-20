// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  WHICH ANSWER PATH A CONFIDENT VOICE ITEM TAKES.                            */
/*                                                                            */
/*  FOUNDER, 2026-09-20: a Confident Voice question on screen, and a red bar  */
/*  under it reading "feedback item is not in this Take's frozen set".        */
/*                                                                            */
/*  The sheet has TWO answer paths for one question, and picks between them   */
/*  in a single expression in DeckChunkModal:                                 */
/*                                                                            */
/*      mlc3FirstClientPresentationEnabled && suggestion.firstClientService    */
/*                                                                            */
/*  Left branch: Mlc3FirstClientPractice → answerServiceFeedback →            */
/*  /user/mlc3/feedback/respond, which checks V3's own frozen membership.     */
/*  Right branch: the legacy chips → saveTakeFeedbackResponse →               */
/*  record_take_feedback_response_v1. Both draw ConfidenceLabelChips and both */
/*  ask the same sentence, so the ONLY observable difference is which call    */
/*  the answer makes — which is why nothing caught this by looking.           */
/*                                                                            */
/*  NOTHING TESTED THE LEFT BRANCH AT ALL, and the mock that was supposed to  */
/*  hold the right one shut was `() => false` — a function object, which is   */
/*  truthy. It could never have selected the branch it named. It survived     */
/*  because no fixture set `firstClientService`, so the second operand was    */
/*  undefined and the expression fell right either way.                       */
/*                                                                            */
/*  This file is the left branch. DeckChunkModal.test.tsx is the right one.   */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DeckChunkModal from "./DeckChunkModal";
import { chunkStateFor, type DeckChunk } from "@/lib/willab/deckChunks";
import type { DocumentSuggestion } from "@/services/api/idealText";

/* `vi.hoisted`, because `vi.mock` factories are lifted above every top-level
 * declaration in the file — a plain `const` spy referenced inside one is a
 * temporal-dead-zone error at import time, not at call time. */
const {
  answerServiceFeedback, confirmFeedbackRender, saveTakeFeedbackResponse,
} = vi.hoisted(() => ({
  /* The parameter lists are declared, not inferred. `vi.fn(async () => …)`
   * types its calls as an EMPTY tuple, so `mock.calls[0]` is a type error at
   * every index — and the assertions that read the arguments are the whole
   * point of these spies. */
  answerServiceFeedback: vi.fn(
    async (
      _identity: Record<string, unknown>,
      _renderReceiptId: string,
      _response: string,
      _idempotencyKey: string,
    ) => ({
      ok: true as const,
      value: {
        response_binding_id: "binding-1", exercise_offer_allowed: false,
      },
    }),
  ),
  confirmFeedbackRender: vi.fn(
    async (
      _identity: Record<string, unknown>,
      _renderId: string,
      _clientVersion: string,
      _idempotencyKey: string,
    ) => ({ ok: true as const, value: { render_receipt_id: "receipt-1" } }),
  ),
  saveTakeFeedbackResponse: vi.fn(
    async (_input: Record<string, unknown>) => ({ ok: true as const }),
  ),
}));

vi.mock("@/hooks/useVisibleLearningExposure", () => ({
  useVisibleLearningExposure: () => undefined,
}));
vi.mock("@/components/results/MediaPlayer", () => ({
  default: () => createElement("div", { "data-testid": "media-player" }),
}));
vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: vi.fn(async () => "test-token"),
}));
/* A BOOLEAN. The real export is `process.env.… === "true"`, inlined at build
 * time, and a mock of the wrong shape cannot control the branch it names. */
vi.mock("@/services/api/mlc3FirstClient", async (load) => {
  const actual = await load<typeof import("@/services/api/mlc3FirstClient")>();
  return {
    ...actual,
    mlc3FirstClientPresentationEnabled: true,
    confirmFeedbackRender,
    answerServiceFeedback,
    fetchServiceCoachGuidance: vi.fn(async () => ({ ok: true, value: [] })),
  };
});
vi.mock("@/services/api/takeFeedback", () => ({ saveTakeFeedbackResponse }));

const TEXT =
  "We should ship it now because the data is clear and the team is ready.";

/** A Confident Voice item the backend HAS attached a service identity to.
 *
 *  `mapFirstClientService` returns null unless every one of these nine fields
 *  is a non-empty string, so a partial fixture would silently land on the
 *  legacy branch and this whole file would pass while testing it. */
const served = {
  id: "s-cv",
  start: 0,
  end: 22,
  quote: "We should ship it now",
  kind: "advice",
  proposedText: null,
  device: null,
  feedbackFamily: "confident_voice",
  source: "confident_voice",
  snippetId: "snip-1",
  takeSessionId: "take-1",
  firstClientService: {
    projectId: "project-1",
    takeId: "take-1",
    membershipId: "membership-1",
    candidateId: "candidate-1",
    feedbackExposureId: "exposure-1",
    contentIdentitySha256: "a".repeat(64),
    n1CandidateSetId: "n1-1",
    authorizationCheckId: "auth-1",
    sourceAcquisitionReceiptId: "receipt-1",
  },
} as unknown as DocumentSuggestion;

/** The same item with no service identity — enrollment failed, or the row is
 *  from a lane the backend does not attach context to. */
const unserved = {
  ...served, firstClientService: undefined,
} as unknown as DocumentSuggestion;

const props = {
  onAccept: vi.fn(async () => true),
  onKeepMine: vi.fn(async () => true),
  onLockIn: vi.fn(async () => ({ outcome: "ok" as const, rootPhraseProposal: null })),
  onKeepEvolving: vi.fn(async () => "ok" as const),
  onSetRootPhrase: vi.fn(async () => true),
  onClose: vi.fn(),
};

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render(item: DocumentSuggestion) {
  const chunk = {
    part: { id: "p1", text: TEXT, locked: false },
    paragraphIndex: 0,
    start: 0,
    end: TEXT.length,
    status: "waiting",
    pendingIds: [item.id],
    approvedIds: [],
  } as DeckChunk;
  await act(async () => {
    root.render(
      createElement(DeckChunkModal, {
        ...props,
        state: chunkStateFor(chunk, { document: TEXT, suggestions: [item] }),
      }),
    );
  });
}

/** The affirmative chip, whichever lane drew it.
 *
 *  Prefix, not equality: both lanes pass `ownerWording`, so the label is
 *  "Yes — Confident" rather than "Yes" (T1, the delivery-signal rename). An
 *  equality match finds nothing and reads as "the lane did not render". */
function yesChips(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll("button")).filter((b) =>
    (b.textContent ?? "").trim().toLowerCase().startsWith("yes"),
  );
}

async function answerYes() {
  const [button] = yesChips();
  if (!button) throw new Error("no affirmative chip rendered");
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("a served Confident Voice item answers through V3", () => {
  it("does not touch the legacy route, which is what was rejecting it", async () => {
    // THE REGRESSION, stated as the thing that actually went wrong. The
    // legacy route validates against `ideal_text_feedback_sets`, which holds
    // V2's three items — never the V3 row on screen. One call here is the
    // red bar the founder photographed.
    await render(served);
    await answerYes();
    expect(saveTakeFeedbackResponse).not.toHaveBeenCalled();
    expect(answerServiceFeedback).toHaveBeenCalledTimes(1);
  });

  it("answers against the exact membership the backend served", async () => {
    // Not merely "an MLC-3 call happened". The identity is what binds the
    // answer to one frozen row; a call carrying the wrong one would be
    // accepted by the server and recorded against another item.
    await render(served);
    await answerYes();
    const [identity, receipt, response] = answerServiceFeedback.mock.calls[0];
    expect(identity).toMatchObject({
      membershipId: "membership-1",
      candidateId: "candidate-1",
      feedbackExposureId: "exposure-1",
    });
    expect(receipt).toBe("receipt-1");
    expect(response).toBe("confident_yes");
  });

  it("will not let the answer go before the render receipt lands", async () => {
    // `answerConfidence` returns early without a receipt, so a chip that is
    // clickable before `confirmFeedbackRender` resolves is a silently
    // dropped answer — the user taps, nothing saves, nothing says so.
    confirmFeedbackRender.mockImplementationOnce(
      () => new Promise(() => {}) as never,
    );
    await render(served);
    const chips = yesChips();
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) expect(chip.hasAttribute("disabled")).toBe(true);
  });
});

describe("an unserved item falls back, and the fallback still works", () => {
  it("uses the legacy route when there is no service identity", async () => {
    // Enrollment can fail for reasons that have nothing to do with this take
    // — no accepted receipt, a service block, an ambiguous principal — and
    // the backend then omits `mlc3_service` and surfaces the row anyway. The
    // question must still be answerable, which is what the V3 membership
    // branch in record_take_feedback_response_v1 (backend #588) is for.
    await render(unserved);
    await answerYes();
    expect(answerServiceFeedback).not.toHaveBeenCalled();
    expect(saveTakeFeedbackResponse).toHaveBeenCalledTimes(1);
  });

  it("sends the canonical identity so the server can find the V3 row", async () => {
    // The legacy route carries candidate/membership/exposure ids for exactly
    // this case. All three or none — the parser rejects a partial set.
    await render(unserved);
    await answerYes();
    const [sent] = saveTakeFeedbackResponse.mock.calls[0];
    expect(sent.feedbackId).toBe("s-cv");
    expect(sent.feedbackFamily).toBe("confident_voice");
    expect(sent.takeSessionId).toBe("take-1");
  });
});
