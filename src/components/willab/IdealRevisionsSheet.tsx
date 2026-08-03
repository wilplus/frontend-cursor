"use client";

import { useState } from "react";
import OverlayCloseButton from "./OverlayCloseButton";
import { useBackDismiss } from "./useBackDismiss";
import type { IdealRevision } from "@/services/api/blockVariants";
import { VARIANT_PICKER_COPY as COPY } from "./variantPickerCopy";

/* -------------------------------------------------------------------------- */
/*  IdealRevisionsSheet — the composition TIMELINE + restore (BE spec          */
/*  §4.3/§4.4, FE-HANDOFF-2026-08-03-variant-picker).                          */
/*                                                                            */
/*  Fear #2's surface: every selection state the document has been in,         */
/*  newest first, head flagged. Restore repoints what that revision            */
/*  recorded (never deletes — the reassurance line is load-bearing copy)       */
/*  and lands as a NEW revision, so restoring is itself undoable.              */
/*                                                                            */
/*  AC-9: `revision` numbers are plumbing (spec §6) — rows render the          */
/*  qualitative reason + date, never "revision 7 of 12".                       */
/* -------------------------------------------------------------------------- */

function SheetBackDismiss({
  onClose,
  consume,
}: {
  onClose: () => void;
  consume: () => boolean;
}) {
  useBackDismiss(onClose, consume);
  return null;
}

function reasonLine(r: IdealRevision): string {
  return r.reason ? COPY.reason[r.reason] : COPY.reason.fallback;
}

function dateLine(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function IdealRevisionsSheet({
  revisions,
  onRestore,
  onClose,
}: {
  revisions: IdealRevision[];
  /** Resolves true when the restore settled (restored OR silently stale —
   *  the host refetched either way); false = the retry line shows. */
  onRestore: (revision: number) => Promise<boolean>;
  onClose: () => void;
}) {
  const [busyRevision, setBusyRevision] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const busy = busyRevision !== null;
  const close = () => {
    if (!busy) onClose();
  };
  const restore = (revision: number) => {
    if (busy) return;
    setBusyRevision(revision);
    setFailed(false);
    void onRestore(revision).then((ok) => {
      setBusyRevision(null);
      if (!ok) setFailed(true);
    });
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={close}
      role="presentation"
    >
      <SheetBackDismiss onClose={onClose} consume={() => busy} />
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={COPY.historyTitle}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="flex flex-col gap-1">
            <p className="text-[14px] font-semibold text-foreground">
              {COPY.historyTitle}
            </p>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {COPY.restoreReassurance}
            </p>
          </div>
          <OverlayCloseButton onClick={close} ariaLabel="Close history" />
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto px-5 pb-5">
          {revisions.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {COPY.historyEmpty}
            </p>
          ) : (
            revisions.map((r) => {
              const when = dateLine(r.createdAt);
              return (
                <div
                  key={r.revision}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                    r.isHead
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-muted/40"
                  }`}
                >
                  <div className="flex min-w-0 flex-col">
                    <p className="text-[13px] font-medium text-foreground">
                      {reasonLine(r)}
                    </p>
                    {when ? (
                      <p className="text-[11px] text-muted-foreground">
                        {when}
                      </p>
                    ) : null}
                  </div>
                  {r.isHead ? (
                    <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-primary">
                      {COPY.headMarker}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => restore(r.revision)}
                      className="shrink-0 rounded-full border border-border px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
                    >
                      {busyRevision === r.revision
                        ? COPY.saving
                        : COPY.restoreAction}
                    </button>
                  )}
                </div>
              );
            })
          )}
          {failed ? (
            <p className="text-[12px] text-muted-foreground">
              {COPY.restoreFailed}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
