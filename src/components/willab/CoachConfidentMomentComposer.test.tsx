// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  CoachConfidentMomentComposer — F2 net (test-quality audit, 2026-09-16)     */
/*                                                                            */
/*  Renders the REAL composer and drives its own gating and overlay open/       */
/*  close behavior. Two assertions are about a DIFFERENT file's composition     */
/*  (CoachStarVerdictOverlay's JSX order, the BFF route's exact backend path —  */
/*  already pinned separately by bffEnvelopes.contract.test.ts) and stay as     */
/*  source checks below: rendering this composer alone cannot exercise another  */
/*  component's own render tree, so they are labeled as such rather than        */
/*  claimed as this component's behavior.                                       */
/* -------------------------------------------------------------------------- */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CoachConfidentMomentComposer from "./CoachConfidentMomentComposer";
import type {
  CoachBundleAuthoringContext,
  CoachFeedbackLanguageTarget,
  CoachGuidanceItem,
} from "@/services/api/coachGuidanceDelivery";

// The composer imports this flag as a live ES-module binding, so a getter on
// the mocked module lets each test flip it without re-importing anything.
const flagState = vi.hoisted(() => ({ enabled: true }));
vi.mock("@/services/api/coachGuidanceDelivery", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/services/api/coachGuidanceDelivery")
  >();
  return {
    ...actual,
    get COACH_CONFIDENT_MOMENT_AUTHORING_UI_ENABLED() {
      return flagState.enabled;
    },
  };
});

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

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
    expectedCurrentRevisionId: null,
    expectedCurrentDeliveryId: null,
    ...overrides,
  };
}

function buildContext(
  targets: CoachFeedbackLanguageTarget[],
): CoachBundleAuthoringContext {
  return {
    bundleId: "22222222-2222-4222-8222-222222222222",
    sourceReviewAttachmentId: "attach-1",
    authorizedTargets: targets,
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
  flagState.enabled = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render(item: CoachGuidanceItem, revealed: boolean) {
  await act(async () => {
    root.render(createElement(CoachConfidentMomentComposer, { item, revealed }));
  });
}
async function click(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}
function editButton(): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("Edit feedback"),
    ) ?? null
  );
}

describe("CoachConfidentMomentComposer — F2 net", () => {
  const satisfiedContext = buildContext([buildTarget()]);

  it("renders nothing unless the presentation flag, revealed, and an authorized target are all present", async () => {
    // (a) the flag off — a broad MLC-3 flag or either feature switch alone is
    // not enough (three-flag AND, D3 rollout note).
    flagState.enabled = false;
    await render(buildItem({ bundleAuthoringContext: satisfiedContext }), true);
    expect(editButton()).toBeNull();
    expect(container.textContent).toBe("");
    flagState.enabled = true;

    // (b) not yet revealed.
    await render(buildItem({ bundleAuthoringContext: satisfiedContext }), false);
    expect(editButton()).toBeNull();

    // (c) revealed, but the database supplied no authoring context at all —
    // the browser never manufactures one.
    await render(buildItem({ bundleAuthoringContext: null }), true);
    expect(editButton()).toBeNull();

    // (d) a context with zero authorized targets.
    await render(buildItem({ bundleAuthoringContext: buildContext([]) }), true);
    expect(editButton()).toBeNull();

    // (e) everything satisfied — only now does it mount.
    await render(buildItem({ bundleAuthoringContext: satisfiedContext }), true);
    expect(editButton()).not.toBeNull();
  });

  it("opens a real dialog on click and closes it again on the back gesture, without changing the blind review boundary", async () => {
    await render(buildItem({ bundleAuthoringContext: satisfiedContext }), true);
    const button = editButton();
    expect(button).not.toBeNull();
    await click(button as HTMLButtonElement);

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(container.textContent).toContain("Edit feedback");
    expect(container.textContent).toContain(
      "This update will appear in the user's feedback flow.",
    );

    // useBackDismiss wires a real popstate listener; firing one for real
    // (not a source-text check) proves the overlay is actually connected to
    // the device Back gesture, not merely mentioning the hook's name.
    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    // Composition facts about OTHER files (this component alone cannot
    // exercise them): the host still wires the exact reveal boundary, and
    // the blind boundary never imports this authoring surface at all.
    const host = read("src/components/willab/CoachStarVerdictOverlay.tsx");
    const blind = read("src/components/willab/CoachInlineBlindExposureBoundary.tsx");
    expect(host).toContain("<CoachConfidentMomentComposer");
    expect(host).toContain("revealed={guidanceBatch?.batchComplete === true}");
    expect(blind).not.toContain("CoachConfidentMomentComposer");
  });

  it("keeps the existing exercise composer directly in the revealed flow (CoachStarVerdictOverlay composition)", () => {
    // Ordering within a different, much larger overlay — checked at the
    // source level rather than by mounting that overlay's full tree here.
    const host = read("src/components/willab/CoachStarVerdictOverlay.tsx");
    expect(host).toMatch(
      /<CoachConfidentMomentComposer[\s\S]*?<CoachGuidanceComposer/,
    );
  });

  it("the BFF route is a transparent adapter to the exact backend path (pinned again in bffEnvelopes.contract.test.ts)", () => {
    const route = read(
      "src/app/api/v2/coach/confident-moment-bundles/[bundleId]/attachments/[attachmentId]/feedback-language/route.ts",
    );
    expect(route).toContain("callBackend(");
    expect(route).toContain(
      "`/v2/coach/confident-moment-bundles/${encodeURIComponent(",
    );
    expect(route).toContain(
      ")}/attachments/${encodeURIComponent(attachmentId)}/feedback-language`",
    );
    expect(route).not.toContain("getBackendUrl");
    expect(route).not.toContain("fetch(");
  });
});
