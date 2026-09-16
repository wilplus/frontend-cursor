// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  CoachFeedbackLanguageEditor — F2 net (test-quality audit, 2026-09-16)      */
/*                                                                            */
/*  Renders the REAL editor and drives it like a coach would: type text, then  */
/*  press Save. publishCoachFeedbackLanguage is mocked at its own module        */
/*  boundary — its request-shape contract (banned identifiers, exact fields)    */
/*  is already pinned for real in coachGuidanceDelivery.test.ts — so this file   */
/*  can focus on what only the COMPONENT can get wrong: does Save actually call  */
/*  it with the component's CURRENT head state (not a stale prop), does that     */
/*  state roll forward correctly from the response for the next save, and does   */
/*  a failed save surface inline instead of silently doing nothing.              */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CoachFeedbackLanguageEditor from "./CoachFeedbackLanguageEditor";
import type {
  CoachFeedbackLanguageTarget,
  CoachGuidanceItem,
} from "@/services/api/coachGuidanceDelivery";

const { publishMock } = vi.hoisted(() => ({ publishMock: vi.fn() }));
vi.mock("@/services/api/coachGuidanceDelivery", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/services/api/coachGuidanceDelivery")
  >();
  return { ...actual, publishCoachFeedbackLanguage: publishMock };
});

function buildTarget(
  overrides: Partial<CoachFeedbackLanguageTarget> = {},
): CoachFeedbackLanguageTarget {
  return {
    bundleAttachmentId: "attach-1",
    reviewAssignmentId: "assign-1",
    revealAccessId: "reveal-1",
    feedbackFamily: "confident_voice",
    allowedOutputKind: "comment",
    allowedCommentPurpose: "actionable_observation",
    sourcePassage: {
      evidenceSpanId: "span-1",
      text: "the pacing steadied by slide two",
      textSha256: "a".repeat(64),
    },
    expectedCurrentRevisionId: "11111111-1111-4111-8111-111111111111",
    expectedCurrentDeliveryId: null,
    ...overrides,
  };
}

function buildItem(overrides: Partial<CoachGuidanceItem> = {}): CoachGuidanceItem {
  return {
    reviewBatchId: "batch-1",
    revealGrantId: "grant-1",
    revealAccessId: "reveal-1",
    reviewAssignmentId: "assign-1",
    feedbackMembershipId: null,
    feedbackCandidateId: null,
    snippetId: "snippet-1",
    transcript: "the pacing steadied by slide two",
    legacyStarKey: null,
    feedbackFamily: "confident_voice",
    features: {
      f0Mean: null, f0Sd: null, speechRate: null, speechRatePct: null,
      meanPause: null, pauseRatio: null, loudnessRange: null, voicedRatio: null,
      f0Slope: null, pauseRegularity: null, intensityEnvelope: null, f0MidEndDelta: null,
    },
    exerciseEligible: false,
    exerciseOfferId: null,
    exerciseVersionId: null,
    needContractId: null,
    authorizationSnapshotId: null,
    sourceRole: null,
    sourcePattern: null,
    sourcePatternPolicyVersion: null,
    ordinalPolicyVersion: null,
    bundleAuthoringContext: null,
    ...overrides,
  };
}

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  publishMock.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function textarea(): HTMLTextAreaElement {
  const el = container.querySelector("textarea");
  if (!el) throw new Error("no textarea rendered");
  return el;
}
function saveButton(): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll("button")).find((b) =>
    /Save|Saved/.test(b.textContent ?? ""),
  );
  if (!btn) throw new Error("no save button rendered");
  return btn;
}
async function type(value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(textarea(), value);
    textarea().dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function click(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}
async function render(item: CoachGuidanceItem, target: CoachFeedbackLanguageTarget) {
  await act(async () => {
    root.render(createElement(CoachFeedbackLanguageEditor, { item, target }));
  });
}

describe("CoachFeedbackLanguageEditor — F2 net", () => {
  it("submits the typed text with the CURRENT heads, and rolls them forward from the response for the next save", async () => {
    const target = buildTarget();
    const item = buildItem();

    publishMock.mockResolvedValueOnce({
      ok: true,
      value: {
        revisionId: "rev-2", revisionSha256: "b".repeat(64),
        deliveryId: null, deliveryState: null, targetTakeId: null,
      },
    });
    await render(item, target);
    await type("The opening felt steadier than the last take.");
    await click(saveButton());

    expect(publishMock).toHaveBeenCalledTimes(1);
    const firstCall = publishMock.mock.calls[0][0];
    expect(firstCall.revisionText).toBe(
      "The opening felt steadier than the last take.",
    );
    expect(firstCall.target.expectedCurrentRevisionId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(firstCall.target.expectedCurrentDeliveryId).toBeNull();
    expect(typeof firstCall.idempotencyKey).toBe("string");
    expect(firstCall.idempotencyKey.length).toBeGreaterThan(0);
    expect(saveButton().textContent).toBe("Saved");

    // Typing again resets to idle and clears the spent idempotency key. The
    // second submit must carry the ROLLED-FORWARD heads from the first
    // response, not the original props — exactly the failure the audit
    // flagged: silently sending the wrong variable at runtime.
    publishMock.mockResolvedValueOnce({
      ok: true,
      value: {
        revisionId: "rev-3", revisionSha256: "c".repeat(64),
        deliveryId: null, deliveryState: null, targetTakeId: null,
      },
    });
    await type("Even steadier on the second pass.");
    await click(saveButton());

    expect(publishMock).toHaveBeenCalledTimes(2);
    const secondCall = publishMock.mock.calls[1][0];
    expect(secondCall.target.expectedCurrentRevisionId).toBe("rev-2");
    expect(secondCall.idempotencyKey).not.toBe(firstCall.idempotencyKey);
  });

  it("shows a failed save inline, never submits whitespace-only text, and never renders a score", async () => {
    const target = buildTarget();
    await render(buildItem(), target);

    // Whitespace-only text never reaches the service at all.
    await type("   ");
    await click(saveButton());
    expect(publishMock).not.toHaveBeenCalled();

    publishMock.mockResolvedValueOnce({
      ok: false,
      error: "This feedback target is no longer available.",
    });
    await type("A real note this time.");
    await click(saveButton());
    expect(publishMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "This feedback target is no longer available.",
    );

    expect(container.textContent ?? "").not.toMatch(
      /\bscore\b|confidence_score|qualification_state/i,
    );
  });

  it("keeps Comment and Rephrase as one typed surface", async () => {
    const commentTarget = buildTarget({ allowedOutputKind: "comment" });
    await render(buildItem(), commentTarget);
    expect(container.querySelector("h3")?.textContent).toBe("Comment");
    expect(container.textContent).toContain("Comment for the user");

    const rephraseTarget = buildTarget({ allowedOutputKind: "rephrase" });
    await render(buildItem(), rephraseTarget);
    expect(container.querySelector("h3")?.textContent).toBe("Rephrase");
    expect(container.textContent).toContain("Rephrase for the user");
  });
});
