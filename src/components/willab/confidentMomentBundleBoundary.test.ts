import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./ConfidentMomentCoachingBundle.tsx", import.meta.url),
  "utf8",
);

describe("Confident Moment user boundary", () => {
  it("uses owner-selected root semantics and renders root controls once", () => {
    expect(source).toContain('"save_owner_selected_root"');
    expect(source).not.toContain('"lock_current_root"');
    expect(source.match(/data-root-controls-for=/g)).toHaveLength(1);
    expect(source).toContain("source_feedback_exposure_id");
    expect(source).toContain("source_owner_response_id");
    expect(source).toContain("source_ideal_text_revision_id");
    expect(source).toContain("source_text_update_binding_id");
  });

  it("retains exact render retry identity outside component remount state", () => {
    expect(source).toContain("const bundleRenderAttempts = new Map");
    expect(source).toContain("const coachRenderAttempts = new Map");
    expect(source).toContain("for (let retry = 0; retry < 2");
  });

  it("retains exact non-render idempotency identities across ambiguous retries", () => {
    expect(source).toContain("const nonRenderIdempotencyKeys = new Map");
    expect(source).toContain("stableIdempotencyKey(responseIdentity");
    expect(source).toContain("persistedDecision");
    expect(source).toContain("currentBundleTextUpdateBinding");
  });

  it("requires successful playback before enabling the five-state response", () => {
    expect(source).toContain('sourcePlayback[item.bundleAttachmentId] !== "completed"');
    expect(source).toContain("fetchConfidentMomentSourcePlayback");
    expect(source).toContain("ConfidentMomentExercisePanel");
  });

  it("keeps terminal source-playback failures non-retryable", () => {
    expect(source).toContain('result.kind === "policy_invalid" || result.kind === "terminal"');
    expect(source).toContain('sourcePlayback[item.bundleAttachmentId] === "terminal"');
  });

  it("places all five confidence responses before the coaching comment", () => {
    const yes = source.indexOf('["Yes", "yes"]');
    const passage = source.indexOf("<blockquote");
    expect(yes).toBeGreaterThan(-1);
    expect(passage).toBeGreaterThan(yes);
    for (const value of ["in_between", "no", "not_sure", "audio_unclear"]) {
      expect(source.indexOf(`"${value}"`)).toBeGreaterThan(yes);
      expect(source.indexOf(`"${value}"`)).toBeLessThan(passage);
    }
    expect(source).toContain('item.feedbackFamily !== "confident_voice" || responses[item.bundleAttachmentId]');
    expect(source).toContain("const visibleItems = confidenceAnswered || !confidenceItem ? items : [confidenceItem]");
  });
});
