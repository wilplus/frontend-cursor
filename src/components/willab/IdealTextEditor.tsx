"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { OVERLAY_ICON_BUTTON_CLASS, OVERLAY_ICON_CLASS } from "./OverlayCloseButton";
import MarkedEditor from "./MarkedEditor";
import { CHUNK_SHEET_COPY } from "./idealEditCopy";
import { useBackDismiss } from "./useBackDismiss";
import TopNavbar from "@/components/TopNavbar";

/**
 * The whole-document Ideal Text editor opened from the ⋯ menu. It deliberately
 * owns only the draft and the editor shell; the host supplies the existing
 * versioned user-edit write so paragraph and whole-document edits share the
 * same contract.
 */
export default function IdealTextEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: string;
  onCancel: () => void;
  onSave: (text: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const empty = draft.trim() === "";
  const dirty = draft !== initial;

  // The editor is a real layer above IdealTextOverlay. Device/browser Back
  // must therefore take the same save-safe path as the visible Back button,
  // rather than reaching the parent overlay and closing the whole Ideal Text.
  useBackDismiss(onCancel, () => {
    goBack();
    return true;
  });

  async function save(): Promise<void> {
    if (saving || empty) return;
    setSaving(true);
    setFailed(false);
    let ok = false;
    try {
      ok = await onSave(draft);
    } catch {
      // The draft stays in this mounted editor and can be retried.
    }
    setSaving(false);
    if (ok) onCancel();
    else setFailed(true);
  }

  function goBack(): void {
    if (saving) return;
    if (!dirty) {
      onCancel();
      return;
    }
    if (empty) {
      setFailed(true);
      return;
    }
    void save();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background pt-[env(safe-area-inset-top)]"
      role="dialog"
      aria-modal="true"
      aria-label="Edit ideal text"
    >
      <TopNavbar contentClassName="max-w-none gap-3 px-4 py-2.5">
        <button
          type="button"
          aria-label="Back to ideal text"
          disabled={saving}
          onClick={goBack}
          className={`${OVERLAY_ICON_BUTTON_CLASS} disabled:opacity-50`}
        >
          <ChevronLeft className={OVERLAY_ICON_CLASS} aria-hidden />
        </button>
        <div className="flex min-w-0 flex-col">
          <h2 className="truncate text-[17px] font-semibold text-foreground">Edit the text</h2>
          <p className="text-[11px] leading-snug text-muted-foreground">Ideal text</p>
        </div>
      </TopNavbar>
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 py-5">
          <MarkedEditor
            value={draft}
            onChange={setDraft}
            textSizeClass="text-[18px]"
            autoFocus
          />
          <p className="text-[13px] leading-snug text-muted-foreground">
            {CHUNK_SHEET_COPY.editorNextTakeNote}
          </p>
          {failed ? (
            <p data-testid="ideal-text-editor-failed" className="text-[13px] text-destructive">
              Couldn&apos;t save this text. Your edits are still here.
            </p>
          ) : null}
        </div>
      </div>
      <div className="bar-space shrink-0 border-t border-border">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-0.5">
          <button
            type="button"
            disabled={saving || empty}
            onClick={() => void save()}
            className="flex min-h-[54px] w-full items-center justify-center rounded-full bg-foreground px-5 text-[16px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            data-bar-word
            className="flex min-h-[48px] w-full items-center justify-center text-[16px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function IdealTextEditorLayer({
  open,
  initial,
  onCancel,
  onSave,
}: {
  open: boolean;
  initial: string;
  onCancel: () => void;
  onSave: (text: string) => Promise<boolean>;
}) {
  if (!open) return null;
  return (
    <IdealTextEditor
      initial={initial}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
}

// Founder-Approved: the whole Ideal Text editor has Back and preserves dirty edits before leaving, 2026-11-18.
