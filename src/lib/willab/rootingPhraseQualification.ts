export const RPQ_V1_UI_ENABLED = false as const;

export type RootingPhraseRoutingState =
  | "eligible_direct"
  | "eligible_after_rerecord"
  | "pending_recording"
  | "pending_owner_alignment_confirmation"
  | "blocked_semantic_mismatch"
  | "blocked_semantic_unavailable"
  | "blocked_confidence_response"
  | "blocked_audio_or_transcript"
  | "blocked_existing_block_root"
  | "stale_text_revision"
  | "invalidated";

export type RootingPhraseControl =
  | "lock_and_make_rooting_phrase"
  | "lock_only"
  | "make_rooting_phrase"
  | "not_now"
  | "practice_this_phrase"
  | "confirm_phrase_anchors_point"
  | "reject_for_slide";

export function controlsForRootingPhraseState(
  state: RootingPhraseRoutingState,
): readonly RootingPhraseControl[] {
  switch (state) {
    case "eligible_direct":
      return ["lock_and_make_rooting_phrase", "lock_only"];
    case "eligible_after_rerecord":
      return ["make_rooting_phrase", "not_now"];
    case "pending_recording":
      return ["practice_this_phrase"];
    case "pending_owner_alignment_confirmation":
      return ["confirm_phrase_anchors_point", "reject_for_slide"];
    default:
      return [];
  }
}

