"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/* -------------------------------------------------------------------------- */
/*  ProjectRowMenu — the ⋯ on the right of a row in the project picker        */
/*  (founder 2026-09-25). One action: a draft row's Delete, behind a          */
/*  confirmation, or a project row's Archive (N14, 2026-09-26), which needs   */
/*  none. Deleting a project lives in Data & consent, never here.             */
/*                                                                            */
/*  The confirmation owns the delete so the row cannot vanish before it       */
/*  landed: on failure the dialog stays open and says so.                     */
/* -------------------------------------------------------------------------- */

export interface ConfirmCopy {
  title: string;
  body: string;
  confirmLabel: string;
}

/** A draft's confirmation, unchanged since 2026-09-25. */
const DRAFT_CONFIRM: ConfirmCopy = {
  title: "Delete this draft?",
  body: "Your unfinished setup answers will be removed.",
  confirmLabel: "Delete",
};

export default function ProjectRowMenu({
  label,
  onDelete,
  actionLabel = "Delete",
  confirm = DRAFT_CONFIRM,
  failedLabel = "Couldn't save that. Try again.",
}: {
  /** The row's visible title, for the menu's accessible name. */
  label: string;
  /** Resolves true once done; false keeps the dialog open with an error. */
  onDelete: () => Promise<boolean>;
  /** The menu item's words. */
  actionLabel?: string;
  /** The confirmation's words; null runs the action straight away. */
  confirm?: ConfirmCopy | null;
  /** Said when an action without a confirmation fails. */
  failedLabel?: string;
}) {
  const [failedDirect, setFailedDirect] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={`More options for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-10 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-border bg-background py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              if (confirm) {
                setConfirming(true);
                return;
              }
              setFailedDirect(false);
              void onDelete()
                .catch(() => false)
                .then((ok) => setFailedDirect(!ok));
            }}
            className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-[14px] transition hover:bg-muted ${
              confirm ? "text-record" : "text-foreground"
            }`}
          >
            {confirm ? <Trash2 className="h-4 w-4" aria-hidden /> : null}
            {actionLabel}
          </button>
        </div>
      ) : null}
      {failedDirect ? (
        <p
          role="alert"
          className="absolute right-0 top-full mt-1 whitespace-nowrap text-[12px] text-record"
        >
          {failedLabel}
        </p>
      ) : null}
      {confirming && confirm ? (
        <ConfirmDelete
          copy={confirm}
          onCancel={() => setConfirming(false)}
          onDelete={onDelete}
        />
      ) : null}
    </div>
  );
}

export function ConfirmDelete({
  copy,
  onCancel,
  onDelete,
}: {
  copy: ConfirmCopy;
  onCancel: () => void;
  onDelete: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  async function confirm() {
    setBusy(true);
    setFailed(false);
    const ok = await onDelete().catch(() => false);
    // On success the row (and this dialog with it) unmounts.
    if (!ok) {
      setBusy(false);
      setFailed(true);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-project-title"
    >
      <div className="w-full max-w-sm rounded-3xl bg-background p-5 shadow-xl">
        <h2
          id="delete-project-title"
          className="break-words text-[18px] font-semibold text-foreground"
        >
          {copy.title}
        </h2>
        <p className="mt-2 text-[14px] text-muted-foreground">
          {copy.body}
        </p>
        {failed ? (
          <p className="mt-2 text-[13px] text-record">
            Couldn&apos;t delete. Try again.
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void confirm()}
            disabled={busy}
            className="rounded-full bg-record text-record-foreground hover:bg-record/90"
          >
            {copy.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
