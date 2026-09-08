"use client";

import {
  controlsForRootingPhraseState,
  RPQ_V1_UI_ENABLED,
  type RootingPhraseControl,
  type RootingPhraseRoutingState,
} from "@/lib/willab/rootingPhraseQualification";

const LABEL: Record<RootingPhraseControl, string> = {
  lock_and_make_rooting_phrase: "Lock & make rooting phrase",
  lock_only: "Lock only",
  make_rooting_phrase: "Make rooting phrase",
  not_now: "Not now",
  practice_this_phrase: "Practice this phrase",
  confirm_phrase_anchors_point: "This phrase anchors my point",
  reject_for_slide: "Not for this slide",
};

export default function RootingPhraseQualificationActions({
  state,
  busy = false,
  onAction,
}: {
  state: RootingPhraseRoutingState | null;
  busy?: boolean;
  onAction?: (action: RootingPhraseControl) => void;
}) {
  if (!RPQ_V1_UI_ENABLED || state === null) return null;
  const controls = controlsForRootingPhraseState(state);
  if (controls.length === 0) return null;

  return (
    <div className="grid gap-2" data-rpq-version="rooting-phrase-qualification-v1">
      {controls.map((control, index) => (
        <button
          key={control}
          type="button"
          disabled={busy}
          onClick={() => onAction?.(control)}
          className={index === 0
            ? "rounded-full bg-foreground px-5 py-3 text-[14px] font-medium text-background disabled:opacity-50"
            : "rounded-full border border-foreground/20 px-5 py-3 text-[14px] font-medium text-foreground disabled:opacity-50"}
        >
          {LABEL[control]}
        </button>
      ))}
    </div>
  );
}

