import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acknowledgeBundleItemRender,
  applyBundleTextUpdate,
  confidentMomentBundleEnabled,
  fetchConfidentMomentExerciseCorrelation,
  fetchConfidentMomentSourcePlayback,
  mapConfidentMomentProjection,
  mapConfidentMomentSummary,
  recordBundleFamilyResponse,
  recordBundleRootAction,
} from "./confidentMomentBundles";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "token" }));

const id = (last: string) => `00000000-0000-4000-8000-0000000000${last}`;
const hash = (digit: string) => digit.repeat(64);

const summary = {
  contract_version: "confident-moment-core-summary-v1",
  document_snapshot_id: id("01"),
  summary_sha256: hash("a"),
  items: [{
    bundle_id: id("02"), paragraph_id: id("03"), slide_index: 0,
    block_key: 0, marker_present: true, is_orange: true, is_locked: false,
    has_coach_update: true, has_unread_coach_update: true, state_revision: 1,
  }],
};

const projection = {
  contract_version: "confident-moment-coaching-bundle-v2",
  feedback_language_shape_version: "feedback-language-items-v2",
  project_id: id("04"), take_id: id("05"), document_snapshot_id: id("01"),
  feedback_membership_id: id("06"), response_sha256: hash("b"),
  coverage: { target_slide_count: 1, achieved_slide_count: 1, target_met: true },
  bundles: [{
    bundle_id: id("02"), bundle_subject_kind: "confidence_anchor",
    slide_index: 0, block_key: 0, paragraph_id: id("03"), state_revision: 1,
    subject: {
      candidate_id: id("02"), evidence_span_id: id("07"),
      canonical_feedback_presentation_id: id("08"),
    },
    confidence_anchor: {
      candidate_id: id("02"), evidence_span_id: id("07"),
      playback_reference_id: id("08"),
    },
    feedback_language_items: [{
      bundle_attachment_id: id("09"), attached_candidate_id: id("02"),
      feedback_family: "confident_voice", canonical_feedback_exposure_id: id("08"),
      canonical_position: 1, resolution_state: "machine_fallback", exclusion_reason: null,
      source_passage: { evidence_span_id: id("07"), text: "A clear point.", text_sha256: hash("c") },
      update_text_available: false, coach_authoring_exclusion_reason: null,
      output: { output_kind: "comment", comment_purpose: "confidence_explanation", text: "You delivered this clearly.", origin: "machine" },
      coach_update: null, owner_decision: null,
    }],
    exercise: null,
    root: {
      active_root_action_id: id("10"), interaction_state_revision: "1",
      is_orange: true, is_locked: false, can_restore_previous: false,
      restore_product_action_id: null,
    },
  }],
};

describe("confident moment transport", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("keeps the presentation gate literal and default-off", () => {
    vi.stubEnv("NEXT_PUBLIC_CONFIDENT_MOMENT_BUNDLE_V1_ENABLED", "");
    expect(confidentMomentBundleEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_CONFIDENT_MOMENT_BUNDLE_V1_ENABLED", "TRUE");
    expect(confidentMomentBundleEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_CONFIDENT_MOMENT_BUNDLE_V1_ENABLED", "true");
    expect(confidentMomentBundleEnabled()).toBe(true);
  });

  it("strictly maps the stable first-paint summary", () => {
    expect(mapConfidentMomentSummary(summary)?.items[0]).toMatchObject({
      bundleId: id("02"), paragraphId: id("03"), hasUnreadCoachUpdate: true,
    });
    expect(mapConfidentMomentSummary({ ...summary, score: 0.9 })).toBeNull();
    expect(mapConfidentMomentSummary({
      ...summary,
      items: [{ ...summary.items[0], has_coach_update: false }],
    })).toBeNull();
  });

  it("maps the exact bundle projection and keeps exercise null nonsemantic", () => {
    const mapped = mapConfidentMomentProjection(projection);
    expect(mapped?.bundles[0]).toMatchObject({
      bundleId: id("02"), exercise: null,
      feedbackLanguageItems: [{ feedbackFamily: "confident_voice" }],
    });
    expect(mapConfidentMomentProjection({
      ...projection,
      bundles: [{ ...projection.bundles[0], exercise: { title: "invented" } }],
    })).toBeNull();
  });

  it("rejects output-family drift and invalid no-anchor root state", () => {
    expect(mapConfidentMomentProjection({
      ...projection,
      bundles: [{
        ...projection.bundles[0],
        feedback_language_items: [{
          ...projection.bundles[0].feedback_language_items[0],
          output: { output_kind: "rephrase", comment_purpose: null, text: "Rewrite", origin: "machine" },
        }],
      }],
    })).toBeNull();
    expect(mapConfidentMomentProjection({
      ...projection,
      bundles: [{
        ...projection.bundles[0], bundle_subject_kind: "no_anchor_paragraph_trigger",
        confidence_anchor: null,
      }],
    })).toBeNull();
  });

  it("preserves multiple exact bundles attached to one paragraph", () => {
    const mapped = mapConfidentMomentSummary({
      ...summary,
      items: [
        summary.items[0],
        { ...summary.items[0], bundle_id: id("11"), state_revision: 2 },
      ],
    });
    expect(mapped?.items.map((item) => item.bundleId)).toEqual([id("02"), id("11")]);
  });

  it("maps the persisted confidence owner decision for hard reload", () => {
    const mapped = mapConfidentMomentProjection({
      ...projection,
      bundles: [{
        ...projection.bundles[0],
        feedback_language_items: [{
          ...projection.bundles[0].feedback_language_items[0],
          owner_decision: {
            feedback_family: "confident_voice", response: "yes",
            decision_id: id("21"), owner_response_id: id("22"),
            response_binding_id: id("23"),
          },
        }],
      }],
    });
    expect(mapped?.bundles[0].feedbackLanguageItems[0].ownerDecision).toEqual({
      feedbackFamily: "confident_voice", response: "yes",
      decisionId: id("21"), ownerResponseId: id("22"), responseBindingId: id("23"),
    });
  });

  it("retains owner provenance when wording is independently excluded", () => {
    const item = projection.bundles[0].feedback_language_items[0];
    const mapped = mapConfidentMomentProjection({
      ...projection,
      bundles: [{
        ...projection.bundles[0],
        feedback_language_items: [{
          ...item,
          resolution_state: "excluded",
          exclusion_reason: "delivery_explicitly_invalidated",
          output: null,
          coach_update: null,
          owner_decision: {
            feedback_family: "confident_voice", response: "yes",
            decision_id: id("24"), owner_response_id: id("25"),
            response_binding_id: id("26"),
          },
        }],
      }],
    });
    expect(mapped?.bundles[0].feedbackLanguageItems[0]).toMatchObject({
      resolutionState: "excluded",
      output: null,
      ownerDecision: {
        feedbackFamily: "confident_voice", response: "yes",
        decisionId: id("24"), ownerResponseId: id("25"),
        responseBindingId: id("26"),
      },
    });
  });

  it("rejects old or mixed item shapes and cross-family owner decisions", () => {
    expect(mapConfidentMomentProjection({
      ...projection,
      feedback_language_shape_version: "feedback-language-items-v1",
    })).toBeNull();
    const item = projection.bundles[0].feedback_language_items[0];
    const { owner_decision: _removed, ...withoutOwnerDecision } = item;
    expect(mapConfidentMomentProjection({
      ...projection,
      bundles: [{
        ...projection.bundles[0],
        feedback_language_items: [withoutOwnerDecision],
      }],
    })).toBeNull();
    expect(mapConfidentMomentProjection({
      ...projection,
      bundles: [{
        ...projection.bundles[0],
        feedback_language_items: [{
          ...item,
          owner_decision: {
            feedback_family: "great_formulation", response: "useful",
            decision_id: id("21"), owner_response_id: null,
            response_binding_id: null,
          },
        }],
      }],
    })).toBeNull();
  });

  it("retries source playback once with the same exact route and returns bytes", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONFIDENT_MOMENT_BUNDLE_V1_ENABLED", "true");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status: 409, ok: false })
      .mockResolvedValueOnce({ status: 200, ok: true, blob: async () => new Blob(["audio"]) });
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchConfidentMomentSourcePlayback({
      bundleId: id("02"), bundleAttachmentId: id("09"),
      signal: new AbortController().signal,
    });
    expect(result.kind).toBe("ready");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(fetchMock.mock.calls[1]?.[0]);
  });

  it("treats source media policy invalid as terminal and never retries", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONFIDENT_MOMENT_BUNDLE_V1_ENABLED", "true");
    const fetchMock = vi.fn().mockResolvedValue({
      status: 422, ok: false,
      json: async () => ({ code: "CONFIDENT_MOMENT_SOURCE_MEDIA_POLICY_INVALID" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchConfidentMomentSourcePlayback({
      bundleId: id("02"), bundleAttachmentId: id("09"),
      signal: new AbortController().signal,
    })).toEqual({ kind: "policy_invalid" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("strictly maps available and nonsemantic not-supplied correlations", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONFIDENT_MOMENT_BUNDLE_V1_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({
        contract_version: "confident-moment-exercise-correlation-v2", status: "not_supplied",
        bundle_id: id("02"), bundle_attachment_id: id("09"), offer_id: null,
        correlation_sha256: hash("d"), dataset_eligible: false,
      }) })
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({
        contract_version: "confident-moment-exercise-correlation-v2", status: "available",
        bundle_id: id("02"), bundle_attachment_id: id("09"), offer_id: id("24"),
        feedback_response_binding_id: id("23"), n1_candidate_set_id: id("25"),
        authorization_check_id: id("26"), source_acquisition_receipt_id: id("27"),
        source_target_speaker_binding_id: id("28"),
        correlation_sha256: hash("e"), dataset_eligible: false,
      }) }));
    expect(await fetchConfidentMomentExerciseCorrelation(id("02"), id("09"))).toMatchObject({
      kind: "ok", value: { status: "not_supplied", offerId: null },
    });
    expect(await fetchConfidentMomentExerciseCorrelation(id("02"), id("09"))).toMatchObject({
      kind: "ok", value: { status: "available", offerId: id("24"), sourceAcquisitionReceiptId: id("27"), sourceTargetSpeakerBindingId: id("28") },
    });
  });

  it("rejects an available exercise correlation without its exact source speaker binding", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONFIDENT_MOMENT_BUNDLE_V1_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({
      contract_version: "confident-moment-exercise-correlation-v2", status: "available",
      bundle_id: id("02"), bundle_attachment_id: id("09"), offer_id: id("24"),
      feedback_response_binding_id: id("23"), n1_candidate_set_id: id("25"),
      authorization_check_id: id("26"), source_acquisition_receipt_id: id("27"),
      correlation_sha256: hash("e"), dataset_eligible: false,
    }) }));
    expect(await fetchConfidentMomentExerciseCorrelation(id("02"), id("09"))).toEqual({ kind: "error" });
  });

  it("rejects the superseded exercise-correlation v1 shape", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONFIDENT_MOMENT_BUNDLE_V1_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      status: 200, ok: true, json: async () => ({
        contract_version: "confident-moment-exercise-correlation-v1",
        status: "not_supplied", bundle_id: id("02"),
        bundle_attachment_id: id("09"), offer_id: null,
        correlation_sha256: hash("d"), dataset_eligible: false,
      }),
    }));
    expect(await fetchConfidentMomentExerciseCorrelation(id("02"), id("09")))
      .toEqual({ kind: "error" });
  });

  it("validates mutation identities and exposes HTTP 409 as typed retry", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONFIDENT_MOMENT_BUNDLE_V1_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ status: 409, ok: false, json: async () => ({ code: "CONFIDENT_MOMENT_PROJECTION_RETRY_REQUIRED" }) })
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({
        render_contract_version: "confident-moment-bundle-item-render-v3",
        bundle_id: id("02"), bundle_attachment_id: id("09"),
        feedback_exposure_id: id("08"), render_instance_id: id("12"),
        render_receipt_id: id("13"), dataset_eligible: false,
      }) }));
    const args = {
      bundleId: id("02"), bundleAttachmentId: id("09"),
      feedbackExposureId: id("08"), renderInstanceId: id("12"),
      idempotencyKey: "render-key",
    };
    expect(await acknowledgeBundleItemRender(args)).toEqual({ kind: "retry" });
    expect(await acknowledgeBundleItemRender(args)).toEqual({
      kind: "ok", value: { renderReceiptId: id("13") },
    });
  });

  it("rejects a successful mutation carrying learning or mismatched identity", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONFIDENT_MOMENT_BUNDLE_V1_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn(async () => ({ status: 200, ok: true, json: async () => ({
      render_contract_version: "confident-moment-bundle-item-render-v3",
      bundle_id: id("99"), bundle_attachment_id: id("09"),
      feedback_exposure_id: id("08"), render_instance_id: id("12"),
      render_receipt_id: id("13"), dataset_eligible: false,
    }) })));
    expect(await acknowledgeBundleItemRender({
      bundleId: id("02"), bundleAttachmentId: id("09"),
      feedbackExposureId: id("08"), renderInstanceId: id("12"),
      idempotencyKey: "render-key",
    })).toEqual({ kind: "error" });
  });

  it("rejects a family response whose server family does not match the item", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONFIDENT_MOMENT_BUNDLE_V1_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn(async () => ({ status: 200, ok: true, json: async () => ({
      family_response_contract_version: "confident-moment-family-response-v1",
      bundle_id: id("02"), bundle_attachment_id: id("09"),
      feedback_family: "rewrite_clarity", response: "yes",
      decision_id: id("14"), owner_response_id: id("15"),
      response_binding_id: id("16"), dataset_eligible: false,
    }) })));
    expect(await recordBundleFamilyResponse({
      bundleId: id("02"), bundleAttachmentId: id("09"),
      feedbackExposureId: id("08"), renderReceiptId: id("13"),
      feedbackFamily: "confident_voice", response: "yes",
      idempotencyKey: "response-key",
    })).toEqual({ kind: "error" });
  });

  it("rejects a response outside the exact family vocabulary before transport", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONFIDENT_MOMENT_BUNDLE_V1_ENABLED", "true");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await recordBundleFamilyResponse({
      bundleId: id("02"), bundleAttachmentId: id("09"),
      feedbackExposureId: id("08"), renderReceiptId: id("13"),
      feedbackFamily: "rewrite_clarity", response: "rewrite_not_sure",
      idempotencyKey: "response-key",
    })).toEqual({ kind: "error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recursively rejects hidden learning fields in mutation responses", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONFIDENT_MOMENT_BUNDLE_V1_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn(async () => ({ status: 200, ok: true, json: async () => ({
      bundle_text_update_contract_version: "bundle-text-update-v1",
      binding_id: id("20"), source_document_snapshot_id: id("01"),
      source_document_version: 2, previous_user_text_revision: "1",
      result_user_text_revision: "2", previous_user_text_sha256: hash("a"),
      result_user_text_sha256: hash("b"), target_part_id: id("03"),
      result_part_revision_id: "2", dataset_eligible: false,
      audit: { score: 0.8 },
    }) })));
    expect(await applyBundleTextUpdate({
      bundleId: id("02"), bundleAttachmentId: id("09"), targetPartId: id("03"),
      body: {
        source_document_snapshot_id: id("01"), source_document_version: 2,
        expected_user_text_revision: "1", expected_user_text_sha256: hash("a"),
      },
    })).toEqual({ kind: "error" });
  });

  it("rejects an internally inconsistent root-action receipt", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONFIDENT_MOMENT_BUNDLE_V1_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn(async () => ({ status: 200, ok: true, json: async () => ({
      root_action_contract_version: "confident-moment-root-action-v1",
      bundle_id: id("02"), bundle_attachment_id: id("09"),
      product_action_id: id("21"), active_root_action_id: null,
      interaction_state_revision: "2", is_orange: false, is_locked: true,
      can_restore_previous: false, restore_product_action_id: null,
      dataset_eligible: false,
    }) })));
    expect(await recordBundleRootAction({
      bundleId: id("02"), bundleAttachmentId: id("09"), body: {},
    })).toEqual({ kind: "error" });
  });
});
