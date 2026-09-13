"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquareText } from "lucide-react";
import CoachFeedbackLanguageEditor from "./CoachFeedbackLanguageEditor";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import {
  COACH_CONFIDENT_MOMENT_AUTHORING_UI_ENABLED,
  type CoachGuidanceItem,
} from "@/services/api/coachGuidanceDelivery";

function targetLabel(target: {
  allowedOutputKind: "comment" | "rephrase";
  allowedCommentPurpose: string | null;
}): string {
  if (target.allowedOutputKind === "rephrase") return "Rephrase";
  if (target.allowedCommentPurpose === "positive_praise") return "Praise";
  return "Comment";
}

function AuthoringOverlay({
  item,
  onClose,
}: {
  item: CoachGuidanceItem;
  onClose: () => void;
}) {
  useBackDismiss(onClose);
  const targets = useMemo(
    () => item.bundleAuthoringContext?.authorizedTargets ?? [],
    [item.bundleAuthoringContext],
  );
  const [selectedId, setSelectedId] = useState(
    targets[0]?.bundleAttachmentId ?? "",
  );
  const selected = targets.find(
    (target) => target.bundleAttachmentId === selectedId,
  ) ?? targets[0] ?? null;

  useEffect(() => {
    if (!targets.some((target) => target.bundleAttachmentId === selectedId)) {
      setSelectedId(targets[0]?.bundleAttachmentId ?? "");
    }
  }, [selectedId, targets]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="coach-confident-moment-title"
      className="fixed inset-0 z-[70] flex flex-col bg-background"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2
            id="coach-confident-moment-title"
            className="text-[16px] font-semibold text-foreground"
          >
            Edit feedback
          </h2>
          <p className="text-[12px] text-muted-foreground">
            This update will appear in the user&apos;s feedback flow.
          </p>
        </div>
        <OverlayCloseButton
          onClick={onClose}
          ariaLabel="Close feedback editor"
        />
      </header>
      <div className="scrollbar-none flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto grid w-full max-w-2xl gap-4 px-4 py-6">
          {targets.length > 1 ? (
            <div
              role="tablist"
              aria-label="Feedback to edit"
              className="flex flex-wrap gap-2"
            >
              {targets.map((target) => (
                <button
                  key={target.bundleAttachmentId}
                  type="button"
                  role="tab"
                  aria-selected={target.bundleAttachmentId === selected?.bundleAttachmentId}
                  onClick={() => setSelectedId(target.bundleAttachmentId)}
                  className={`rounded-full border px-3 py-1.5 text-[13px] ${
                    target.bundleAttachmentId === selected?.bundleAttachmentId
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-foreground"
                  }`}
                >
                  {targetLabel(target)}
                </button>
              ))}
            </div>
          ) : null}
          {selected ? (
            <CoachFeedbackLanguageEditor
              key={selected.bundleAttachmentId}
              item={item}
              target={selected}
              autoFocus
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Post-reveal entry point. The browser never manufactures authoring context:
 * without the exact database-supplied Bundle target set, nothing is mounted. */
export default function CoachConfidentMomentComposer({
  item,
  revealed,
}: {
  item: CoachGuidanceItem;
  revealed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const context = item.bundleAuthoringContext;
  if (
    !COACH_CONFIDENT_MOMENT_AUTHORING_UI_ENABLED || !revealed || !context ||
    context.authorizedTargets.length === 0
  ) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-background px-3 py-2 text-[13px] font-medium text-foreground"
      >
        <MessageSquareText className="h-4 w-4" aria-hidden />
        Edit feedback
      </button>
      {open ? (
        <AuthoringOverlay item={item} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
