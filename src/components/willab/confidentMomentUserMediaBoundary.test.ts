import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const code = (path: string) => readFileSync(path, "utf8");

describe("Confident Moment user media boundary", () => {
  it("keeps source playback authenticated, abortable, same-origin, and no-store", () => {
    const route = code("src/app/api/v2/user/confident-moment-bundles/[bundleId]/attachments/[attachmentId]/source-playback/route.ts");
    expect(route).toContain("getAccessToken");
    expect(route).toContain("signal: request.signal");
    expect(route).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(route).not.toContain("presign");
  });

  it("correlates read-only and never creates an offer as lookup", () => {
    const api = code("src/services/api/confidentMomentBundles.ts");
    expect(api).toContain("fetchConfidentMomentExerciseCorrelation");
    expect(api).toContain("confident-moment-exercise-correlation-v2");
    expect(api).not.toMatch(/fetchConfidentMomentExerciseCorrelation[\s\S]{0,1600}method:\s*"POST"/);
    expect(api).toContain('source_target_speaker_binding_id');
  });

  it("carries the exact re-record speaker bindings into the explicit root save", () => {
    const panel = code("src/components/willab/ConfidentMomentExercisePanel.tsx");
    const bundle = code("src/components/willab/ConfidentMomentCoachingBundle.tsx");
    expect(panel).toContain("result.value.speakerTarget.targetBindingId");
    expect(panel).toContain("correlation.sourceTargetSpeakerBindingId");
    expect(panel).toContain("onPracticeSourceReady");
    expect(bundle).toContain("source_practice_attempt_id");
    expect(bundle).toContain("source_target_speaker_binding_id");
    expect(bundle).toContain("practice_target_speaker_binding_id");
    expect(bundle).toContain('action === "save_owner_selected_root"');
  });

  it("keeps practice locked until playback completion is durably confirmed", () => {
    const panel = code("src/components/willab/ConfidentMomentExercisePanel.tsx");
    expect(panel).toContain('"playback_completed"');
    expect(panel).toContain('setExercisePlaybackState(result.ok ? "confirmed" : "failed")');
    expect(panel).toContain('exercisePlaybackState !== "confirmed"');
    expect(panel).toContain("Try again");
  });

  it("renders the exact randomized owner pair and restores source playback after reload", () => {
    const panel = code("src/components/willab/ConfidentMomentExercisePanel.tsx");
    const bundle = code("src/components/willab/ConfidentMomentCoachingBundle.tsx");
    expect(panel).toContain("paired.ownerPair.leftClip, paired.ownerPair.rightClip");
    expect(panel).toContain('clip === "after" ? paired.audioRef : sourceAudioUrl');
    expect(panel).toContain("data-owner-pair-assignment");
    expect(panel).toContain("Load both recordings");
    expect(panel).toContain("Did the exercise help?");
    expect(panel).toContain("playableComparisonClips.size !== 2");
    expect(panel).toContain("onCanPlay");
    expect(bundle).toContain("onLoadSourcePlayback={() => void loadSourcePlayback(confidenceItem)}");
    expect(bundle).toContain("onCancelSourcePlayback");
  });

  it("shows no no-match copy for structural not-supplied", () => {
    const panel = code("src/components/willab/ConfidentMomentExercisePanel.tsx");
    expect(panel).toContain('correlation?.status === "not_supplied"');
    expect(panel).not.toContain("no match");
    expect(panel).not.toContain("not ready");
    expect(panel).toContain("correlationRetryRequired");
    expect(panel).toContain("Try again");
  });

  it("deduplicates Bundle authoring by exact blind review assignment", () => {
    const coach = code("src/components/willab/CoachStarVerdictOverlay.tsx");
    expect(coach).toContain("blindBundleAssignmentIds");
    expect(coach).toContain("!blindBundleAssignmentIds.has(item.reviewAssignmentId)");
  });
});
