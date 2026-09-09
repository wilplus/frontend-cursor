import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  COACH_INLINE_AUTHORING_UI_ENABLED,
  COACH_GUIDANCE_D3_UI_ENABLED,
  coachGuidanceItemsForReviewAct,
  mapCoachGuidanceBatch,
  mapFirstClientCoachReviews,
  submitCoachGuidance,
} from "./coachGuidanceDelivery";

afterEach(() => vi.restoreAllMocks());

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
    authorization_snapshot_id: "authorization-1",
    source_role: "source_before_exercise",
    source_pattern: "near_confident",
    source_pattern_policy_version: "confidence-pattern-source-v1",
    ordinal_policy_version: "confidence-pattern-distance-v1",
    ...overrides,
  };
}

describe("Coach Guidance D3 disabled boundary", () => {
  it("has no runtime environment override", () => {
    expect(COACH_GUIDANCE_D3_UI_ENABLED).toBe(false);
    expect(COACH_INLINE_AUTHORING_UI_ENABLED).toBe(false);
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
    expect(overlay).toContain("!COACH_INLINE_AUTHORING_UI_ENABLED");
    expect(overlay).toContain("fetchCoachGuidanceBatch(arcId)");
    expect(overlay).toContain("CoachGuidanceComposer");
    expect(overlay).toContain("transcriptRevealed={false}");
  });

  it("maps exact source identity for inline no-match authoring", () => {
    const batch = mapCoachGuidanceBatch({
      review_batch_id: "batch-1",
      reveal_grant_id: "grant-1",
      batch_complete: true,
      synthetic_only: true,
      serves_user: false,
      dataset_eligible: false,
      items: [wireItem({ exercise_version_id: null })],
    });
    expect(batch?.items[0]).toMatchObject({
      sourceRole: "source_before_exercise",
      sourcePattern: "near_confident",
      authorizationSnapshotId: "authorization-1",
      exerciseVersionId: null,
    });
  });

  it("maps and mounts both sides of a mixed canonical batch by review act", () => {
    const batch = mapCoachGuidanceBatch({
      review_batch_id: "batch-1",
      reveal_grant_id: "grant-1",
      batch_complete: true,
      synthetic_only: true,
      serves_user: false,
      dataset_eligible: false,
      items: [
        wireItem(),
        wireItem({
          review_assignment_id: "assignment-ordinary",
          reveal_access_id: "access-ordinary",
          feedback_membership_id: null,
          feedback_candidate_id: null,
          snippet_id: "snippet-ordinary",
          exercise_eligible: false,
          exercise_offer_id: null,
          exercise_version_id: null,
          need_contract_id: null,
          authorization_snapshot_id: null,
          source_pattern: null,
          source_pattern_policy_version: null,
          ordinal_policy_version: null,
        }),
      ],
    });
    expect(batch?.items.map((item) => item.reviewAssignmentId)).toEqual([
      "assignment-1", "assignment-ordinary",
    ]);
    const ordinary = coachGuidanceItemsForReviewAct(batch, {
      reviewAssignmentId: "assignment-ordinary",
      snippetId: "snippet-ordinary",
    });
    expect(ordinary).toHaveLength(1);
    expect(ordinary[0]).toMatchObject({
      feedbackMembershipId: null,
      feedbackCandidateId: null,
      exerciseEligible: false,
    });
    const overlay = readFileSync(
      resolve(process.cwd(), "src/components/willab/CoachStarVerdictOverlay.tsx"),
      "utf8",
    );
    expect(overlay).toContain("coachGuidanceItemsForReviewAct(guidanceBatch");
    expect(overlay).toContain("key={item.reviewAssignmentId}");
    expect(overlay).not.toContain("key={item.feedbackCandidateId}");
  });

  it("rejects exercise eligibility without exact offer-specific identities", () => {
    const raw = {
      review_batch_id: "batch-1",
      reveal_grant_id: "grant-1",
      batch_complete: true,
      synthetic_only: true,
      serves_user: false,
      dataset_eligible: false,
    };
    expect(mapCoachGuidanceBatch({
      ...raw,
      items: [wireItem({ feedback_membership_id: null })],
    })).toBeNull();
    expect(mapCoachGuidanceBatch({
      ...raw,
      items: [wireItem({ feedback_candidate_id: null })],
    })).toBeNull();
  });

  it("submits ordinary guidance with exact review identity and no fake offer IDs", async () => {
    const batch = mapCoachGuidanceBatch({
      review_batch_id: "batch-ordinary",
      reveal_grant_id: "grant-ordinary",
      batch_complete: true,
      synthetic_only: true,
      serves_user: false,
      dataset_eligible: false,
      items: [wireItem({
        review_batch_id: "batch-ordinary",
        reveal_grant_id: "grant-ordinary",
        reveal_access_id: "access-ordinary",
        review_assignment_id: "assignment-ordinary",
        feedback_membership_id: null,
        feedback_candidate_id: null,
        exercise_eligible: false,
        exercise_offer_id: null,
        exercise_version_id: null,
        need_contract_id: null,
      })],
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ attachment_version_id: "version-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const result = await submitCoachGuidance({
      item: batch!.items[0],
      writtenNote: "Slow down at the close.",
      video: null,
      attachmentClass: "general_product_guidance",
      productSubcategory: "delivery",
      idempotencyKey: "ordinary-guidance-1",
    });
    expect(result).toEqual({ ok: true });
    const request = fetchMock.mock.calls[0][1]!;
    const body = request.body as FormData;
    expect(body.get("review_batch_id")).toBe("batch-ordinary");
    expect(body.get("reveal_grant_id")).toBe("grant-ordinary");
    expect(body.get("reveal_access_id")).toBe("access-ordinary");
    expect(body.get("review_assignment_id")).toBe("assignment-ordinary");
    expect(body.get("feedback_membership_id")).toBe("");
    expect(body.get("feedback_candidate_id")).toBe("");
    expect(body.get("attachment_class")).toBe("general_product_guidance");
  });

  it("forwards stable idempotency through both multipart BFF routes", () => {
    const attachments = readFileSync(
      resolve(
        process.cwd(),
        "src/app/api/v2/coach/guidance/attachments/route.ts",
      ),
      "utf8",
    );
    const drafts = readFileSync(
      resolve(
        process.cwd(),
        "src/app/api/v2/coach/guidance/exercise-drafts/route.ts",
      ),
      "utf8",
    );
    for (const route of [attachments, drafts]) {
      expect(route).toContain('req.headers.get("Idempotency-Key")');
      expect(route).toContain('headers: { "Idempotency-Key": idempotencyKey }');
    }
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
