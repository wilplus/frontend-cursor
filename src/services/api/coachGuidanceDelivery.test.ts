import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  COACH_GUIDANCE_D3_UI_ENABLED,
  mapCoachGuidanceBatch,
} from "./coachGuidanceDelivery";

function wireItem(overrides: Record<string, unknown> = {}) {
  return {
    review_batch_id: "batch-1",
    reveal_grant_id: "grant-1",
    reveal_access_id: "access-1",
    review_assignment_id: "assignment-1",
    feedback_membership_id: "membership-1",
    feedback_candidate_id: "candidate-1",
    snippet_id: "snippet-1",
    feedback_family: "confident_voice",
    features: { speech_rate: 133, pause_ratio: 0.21 },
    exercise_eligible: true,
    exercise_offer_id: "offer-1",
    exercise_version_id: "version-1",
    need_contract_id: "need-1",
    ...overrides,
  };
}

describe("Coach Guidance D3 disabled boundary", () => {
  it("has no runtime environment override", () => {
    expect(COACH_GUIDANCE_D3_UI_ENABLED).toBe(false);
  });

  it("accepts only a complete non-serving batch", () => {
    const batch = mapCoachGuidanceBatch({
      review_batch_id: "batch-1",
      reveal_grant_id: "grant-1",
      batch_complete: true,
      synthetic_only: true,
      serves_user: false,
      dataset_eligible: false,
      items: [wireItem()],
    });
    expect(batch?.items[0].features.speechRate).toBe(133);
    expect(batch?.items[0].features.pauseRatio).toBe(0.21);
  });

  it("rejects partial, serving, or malformed context", () => {
    expect(mapCoachGuidanceBatch({ batch_complete: false, items: [] })).toBeNull();
    expect(
      mapCoachGuidanceBatch({
        review_batch_id: "batch-1",
        reveal_grant_id: "grant-1",
        batch_complete: true,
        synthetic_only: true,
        serves_user: true,
        dataset_eligible: false,
        items: [],
      }),
    ).toBeNull();
    expect(
      mapCoachGuidanceBatch({
        review_batch_id: "batch-1",
        reveal_grant_id: "grant-1",
        batch_complete: true,
        synthetic_only: true,
        serves_user: false,
        dataset_eligible: false,
        items: [wireItem({ reveal_access_id: "" })],
      }),
    ).toBeNull();
  });

  it("mounts authoring only through the post-batch context", () => {
    const overlay = readFileSync(
      resolve(process.cwd(), "src/components/willab/CoachStarVerdictOverlay.tsx"),
      "utf8",
    );
    expect(overlay).toContain("if (!COACH_GUIDANCE_D3_UI_ENABLED || !blindComplete)");
    expect(overlay).toContain("fetchCoachGuidanceBatch(arcId)");
    expect(overlay).toContain("CoachGuidanceComposer");
  });
});
