import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  COACH_GUIDANCE_D3_UI_ENABLED,
  mapCoachGuidanceBatch,
  mapFirstClientCoachReviews,
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
    const firstClientApi = readFileSync(
      resolve(process.cwd(), "src/services/api/mlc3FirstClient.ts"),
      "utf8",
    );
    expect(firstClientApi).toContain("NEXT_PUBLIC_MLC3_PILOT_UI_ENABLED");
    expect(firstClientApi).not.toContain(
      'process.env.NEXT_PUBLIC_MLC3_PILOT_ENABLED === "true"',
    );
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
    expect(batch?.operationMode).toBe("synthetic_dark");
  });

  it("accepts an allowlisted service batch without treating it as synthetic", () => {
    const batch = mapCoachGuidanceBatch({
      review_batch_id: "batch-1",
      reveal_grant_id: "grant-1",
      batch_complete: true,
      operation_mode: "allowlisted_service",
      synthetic_only: false,
      serves_user: false,
      dataset_eligible: false,
      items: [wireItem()],
    });
    expect(batch?.operationMode).toBe("allowlisted_service");
    expect(batch?.syntheticOnly).toBe(false);
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

  it("keeps pre-judgment coach playback opaque", () => {
    const batch = mapFirstClientCoachReviews({
      project_id: "project-1",
      review_sets: [{
        review_set_id: "set-1",
        practice_session_id: "practice-1",
        complete: false,
        assignments: [
          {
            assignment_id: "source-1",
            audio_ref: "/api/v2/coach/mlc3/reviews/playback/11111111-1111-1111-1111-111111111111",
            packet_sha256: "a".repeat(64),
            taxonomy_version: "confidence-five-state-v1",
            judgment: null,
          },
          {
            assignment_id: "practice-1",
            audio_ref: "/api/v2/coach/mlc3/reviews/playback/22222222-2222-2222-2222-222222222222",
            packet_sha256: "b".repeat(64),
            taxonomy_version: "confidence-five-state-v1",
            judgment: "rating_yes",
          },
        ],
      }],
    });
    expect(batch?.reviewSets[0].assignments.every(
      (item) => !Object.hasOwn(item, "evidenceKind") &&
        !Object.hasOwn(item, "startOffsetMs") &&
        !Object.hasOwn(item, "durationMs"),
    )).toBe(true);
    expect(batch?.reviewSets[0].assignments[1].judgment).toBe("rating_yes");
    const bff = readFileSync(
      resolve(
        process.cwd(),
        "src/app/api/v2/coach/mlc3/[...path]/route.ts",
      ),
      "utf8",
    );
    expect(bff).toContain("reviews/playback/${UUID}");
    expect(bff).toContain("backendFetch(path");
    expect(bff).toContain('"Cache-Control", "private, no-store, max-age=0"');
  });
});
