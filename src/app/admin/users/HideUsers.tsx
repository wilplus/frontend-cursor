"use client";

import { type KeyboardEvent, useEffect } from "react";
import { EyeOff, ListChecks, MoreVertical, X } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Hiding people from the Users list (founder 2026-10-27, N221). Only the     */
/*  list changes: the account stays as it is. People are deleted elsewhere,    */
/*  with "Delete user" on the profile or their own "Delete my account". A     */
/*  hidden person leaves the list for good; only Undo brings them back.       */
/* -------------------------------------------------------------------------- */

const BTN =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-foreground/15 px-3 py-2 text-sm font-medium transition-colors hover:bg-foreground/[0.05] disabled:opacity-40";
const DARK_BTN =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-40";

/** Hide or show each person, one after another; the ones that worked, and
 *  the ones that did not. */
export async function markHidden(ids: string[], hidden: boolean): Promise<{ done: string[]; failed: string[] }> {
  const done: string[] = [];
  const failed: string[] = [];
  for (const userId of ids) {
    const res = await fetch(`/api/v2/admin/people/${encodeURIComponent(userId)}/hidden`, {
      method: hidden ? "PUT" : "DELETE",
    }).catch(() => null);
    (res?.ok ? done : failed).push(userId);
  }
  return { done, failed };
}

/** The ⋮ button on the left of a row, and its menu. */
export function RowMenu({ label, open, onToggle, onSelect, onHide }: {
  label: string;
  open: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onHide: () => void;
}) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && open) onToggle();
  };
  return (
    <div className="relative h-8 w-8" onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        className={`flex h-8 w-8 items-center justify-center rounded-lg text-foreground/55 hover:bg-foreground/[0.07] hover:text-foreground ${open ? "bg-foreground/[0.07] text-foreground" : ""}`}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <>
          <button type="button" aria-label="Close menu" tabIndex={-1} onClick={onToggle} className="fixed inset-0 z-20 cursor-default" />
          <div role="menu" aria-label={`Actions for ${label}`} className="absolute left-0 top-10 z-30 flex w-52 flex-col rounded-xl border border-foreground/12 bg-background p-1 shadow-lg">
            <button type="button" role="menuitem" autoFocus onClick={onSelect} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-foreground/[0.05]">
              <ListChecks className="h-4 w-4" aria-hidden />
              Select
            </button>
            <button type="button" role="menuitem" onClick={onHide} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-foreground/[0.05]">
              <EyeOff className="h-4 w-4" aria-hidden />
              Hide
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** The bar while choosing several people. */
export function SelectionBar({ count, busy, onSelectAll, onCancel, onHide }: {
  count: number;
  busy: boolean;
  onSelectAll: () => void;
  onCancel: () => void;
  onHide: () => void;
}) {
  return (
    <div className="flex flex-1 flex-wrap items-center gap-2 rounded-xl border border-foreground/15 bg-foreground/[0.03] py-1.5 pl-3.5 pr-1.5">
      <span className="text-sm font-medium">{count === 1 ? "1 selected" : `${count} selected`}</span>
      <button type="button" onClick={onSelectAll} className="px-2 py-1.5 text-sm font-medium underline">
        Select all shown
      </button>
      <span className="flex-1" />
      <button type="button" onClick={onCancel} className={BTN}>
        Cancel
      </button>
      <button type="button" disabled={count === 0 || busy} onClick={onHide} className={DARK_BTN}>
        <EyeOff className="h-3.5 w-3.5" aria-hidden />
        {count > 1 ? `Hide ${count} users` : "Hide user"}
      </button>
    </div>
  );
}

/** "Hidden." at the bottom, with Undo. */
export function HiddenToast({ onUndo, onClose }: { onUndo: () => void; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 9000);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div role="status" className="fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl bg-foreground py-2.5 pl-4 pr-2.5 text-sm text-background shadow-xl">
      <span>Hidden.</span>
      <button type="button" onClick={onUndo} className="rounded-lg bg-background/15 px-3 py-1.5 font-medium">
        Undo
      </button>
      <button type="button" aria-label="Close" onClick={onClose} className="flex p-1.5 text-background/70">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
