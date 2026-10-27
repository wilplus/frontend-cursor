"use client";

import { type KeyboardEvent, useEffect } from "react";
import { ListChecks, MoreVertical, Trash2, X } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Deleting people from the Users list (founder 2026-10-27, from the approved */
/*  prototype). The same road as "Delete user" on a profile: the account stops */
/*  now, the data is deleted after seven days, cancellable until then. Here a  */
/*  deleted person leaves the list at once and waits under "Being deleted".    */
/* -------------------------------------------------------------------------- */

export interface Deletion {
  request_id: string;
  requested_at: string | null;
  completes_after: string | null;
  cancellable: boolean;
}

export interface DeleteResult {
  userId: string;
  deletion: (Partial<Deletion> & { kind?: string; state?: string }) | null;
}

const BTN =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-foreground/15 px-3 py-2 text-sm font-medium transition-colors hover:bg-foreground/[0.05] disabled:opacity-40";
const RED_BTN =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-40";

export function formatDay(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

/** Seven days from now: when the data of a deletion asked now is deleted. */
export function sevenDaysOn(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

/** Ask the backend to delete each account, one after another. */
export async function deleteAccounts(ids: string[]): Promise<{ done: DeleteResult[]; failed: string[] }> {
  const done: DeleteResult[] = [];
  const failed: string[] = [];
  for (const userId of ids) {
    const res = await fetch(`/api/v2/admin/people/${encodeURIComponent(userId)}/delete`, { method: "POST" }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) done.push({ userId, deletion: body.deletion ?? null });
    else failed.push(userId);
  }
  return { done, failed };
}

/** Cancel one deletion inside its window. */
export async function cancelDeletion(userId: string, requestId: string): Promise<boolean> {
  const res = await fetch(
    `/api/v2/admin/people/${encodeURIComponent(userId)}/delete/${encodeURIComponent(requestId)}/cancel`,
    { method: "POST" },
  ).catch(() => null);
  return Boolean(res?.ok);
}

/** The ⋮ button on the left of a row, and its menu. */
export function RowMenu({ label, open, onToggle, onSelect, onDelete }: {
  label: string;
  open: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onDelete: () => void;
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
            <button type="button" role="menuitem" onClick={onDelete} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-destructive hover:bg-foreground/[0.05]">
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete user
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** "Active" and "Being deleted". */
export function ViewTabs({ deleting, onChange }: { deleting: boolean; onChange: (deleting: boolean) => void }) {
  const tab = (on: boolean) =>
    `rounded-lg px-3 py-2 text-sm ${on ? "bg-foreground text-background" : "text-foreground/60 hover:bg-foreground/[0.05] hover:text-foreground"}`;
  return (
    <div role="tablist" aria-label="Which users" className="flex gap-1">
      <button type="button" role="tab" aria-selected={!deleting} onClick={() => onChange(false)} className={tab(!deleting)}>
        Active
      </button>
      <button type="button" role="tab" aria-selected={deleting} onClick={() => onChange(true)} className={tab(deleting)}>
        Being deleted
      </button>
    </div>
  );
}

/** The bar while choosing several people. */
export function SelectionBar({ count, busy, onSelectAll, onCancel, onDelete }: {
  count: number;
  busy: boolean;
  onSelectAll: () => void;
  onCancel: () => void;
  onDelete: () => void;
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
      <button type="button" disabled={count === 0 || busy} onClick={onDelete} className={RED_BTN}>
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        {count > 1 ? `Delete ${count} users` : "Delete user"}
      </button>
    </div>
  );
}

/** "Delete … ?" before anything happens. */
export function ConfirmDelete({ emails, busy, onCancel, onConfirm }: {
  emails: string[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const many = emails.length > 1;
  const shown = emails.slice(0, 5);
  const more = emails.length - shown.length;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !busy) onCancel();
  };
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 px-4 pt-40" onKeyDown={onKeyDown}>
      <div role="dialog" aria-modal="true" aria-labelledby="delete-users-title" className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-background p-6 shadow-2xl">
        <h2 id="delete-users-title" className="text-lg font-semibold">
          {many ? `Delete ${emails.length} users?` : `Delete ${emails[0] || "this user"}?`}
        </h2>
        {many ? (
          <ul className="flex flex-col gap-1 rounded-lg bg-foreground/[0.04] px-3 py-2.5 text-[13px]">
            {shown.map((email, i) => <li key={`${email}-${i}`}>{email}</li>)}
            {more > 0 ? <li>{`and ${more} more`}</li> : null}
          </ul>
        ) : null}
        <p className="text-sm leading-relaxed text-foreground/75">
          {many ? "Their accounts stop now." : "Their account stops now."} They leave this list now. Their data is deleted
          after {formatDay(sevenDaysOn())}. You can cancel until then.
        </p>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" autoFocus disabled={busy} onClick={onCancel} className={BTN}>
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={onConfirm} className={RED_BTN}>
            {many ? `Delete ${emails.length} users` : "Delete user"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Deleted." at the bottom, with Undo while the deletions can be cancelled. */
export function DeletedToast({ completesAfter, canUndo, onUndo, onClose }: {
  completesAfter: string | null;
  canUndo: boolean;
  onUndo: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 9000);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div role="status" className="fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl bg-foreground py-2.5 pl-4 pr-2.5 text-sm text-background shadow-xl">
      <span>{completesAfter ? `Deleted. Data goes after ${formatDay(completesAfter)}.` : "Deleted."}</span>
      {canUndo ? (
        <button type="button" onClick={onUndo} className="rounded-lg bg-background/15 px-3 py-1.5 font-medium">
          Undo
        </button>
      ) : null}
      <button type="button" aria-label="Close" onClick={onClose} className="flex p-1.5 text-background/70">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
