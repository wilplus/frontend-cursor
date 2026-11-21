"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Archive, MoreHorizontal, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/* -------------------------------------------------------------------------- */
/*  ProjectRowMenu — the ⋯ on the right of a manageable row. Existing callers */
/*  may still provide one action plus a secondary action; newer rows pass an  */
/*  explicit action list so each owner-authorized operation can carry its own  */
/*  icon and confirmation.                                                     */
/*                                                                            */
/*  The confirmation owns the delete so the row cannot vanish before it       */
/*  landed. A caller may dismiss a failed confirmation to return control to   */
/*  the retained row; other failures stay in the dialog. It is drawn on the   */
/*  page itself: a row that moves its ⋯ with a transform would otherwise trap */
/*  the fixed dialog inside the ⋯'s own box (the corpus list, 2026-10-20).    */
/* -------------------------------------------------------------------------- */

/** A second action under the first, always behind its confirmation. */
export interface SecondaryAction {
  label: string;
  confirm: ConfirmCopy;
  onRun: () => Promise<boolean>;
  icon?: LucideIcon;
  failedLabel?: string;
}

/** One owner-authorized action shown in a row's menu. */
export interface RowMenuAction {
  label: string;
  onRun: () => Promise<boolean>;
  confirm?: ConfirmCopy | null;
  failedLabel?: string;
  icon?: LucideIcon;
  destructive?: boolean;
  /** Let the row become usable again after this confirmed action fails. */
  dismissConfirmationOnFailure?: boolean;
}

export interface ConfirmCopy {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  failedLabel?: string;
}

const MENU_WIDTH = 176;
const MENU_EDGE_GAP = 8;
const MENU_TRIGGER_GAP = 4;
const MENU_ROW_HEIGHT = 41;

function positionMenu(
  trigger: DOMRect,
  actionCount: number,
  align: "left" | "right",
): CSSProperties {
  const estimatedHeight = actionCount * MENU_ROW_HEIGHT + 10;
  const below = trigger.bottom + MENU_TRIGGER_GAP;
  const top = below + estimatedHeight <= window.innerHeight - MENU_EDGE_GAP
    ? below
    : Math.max(MENU_EDGE_GAP, trigger.top - MENU_TRIGGER_GAP - estimatedHeight);
  const wantedLeft = align === "left" ? trigger.left : trigger.right - MENU_WIDTH;
  const left = Math.max(
    MENU_EDGE_GAP,
    Math.min(wantedLeft, window.innerWidth - MENU_WIDTH - MENU_EDGE_GAP),
  );
  return { top, left, width: MENU_WIDTH };
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
  secondary,
  actions,
  menuAlign = "right",
  menuAriaLabel,
}: {
  /** The row's visible title, for the menu's accessible name. */
  label: string;
  /** Resolves true once done; false keeps the dialog open with an error. */
  onDelete?: () => Promise<boolean>;
  /** The menu item's words. */
  actionLabel?: string;
  /** The confirmation's words; null runs the action straight away. */
  confirm?: ConfirmCopy | null;
  /** Said when an action without a confirmation fails. */
  failedLabel?: string;
  /** A second, confirmed action below the first. */
  secondary?: SecondaryAction;
  /** Full action list for rows with more than the legacy two actions. */
  actions?: RowMenuAction[];
  /** Which edge of the ⋯ the open menu lines up with: "left" when the ⋯ sits
   *  on a row's left edge (the coach panel's lists, founder 2026-10-20). */
  menuAlign?: "left" | "right";
  /** Localised accessible name for the row's menu trigger. */
  menuAriaLabel?: string;
}) {
  const [failedDirect, setFailedDirect] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<CSSProperties | null>(null);
  const [pendingAction, setPendingAction] = useState<RowMenuAction | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const menuActions: RowMenuAction[] = actions ?? [
    {
      label: actionLabel,
      confirm,
          onRun: onDelete ?? (() => Promise.resolve(false)),
          failedLabel,
          icon: confirm
            ? Trash2
            : actionLabel.toLowerCase().includes("edit")
              ? Pencil
              : Archive,
      destructive: Boolean(confirm),
    },
    ...(secondary
      ? [{
          label: secondary.label,
          confirm: secondary.confirm,
          onRun: secondary.onRun,
          failedLabel: secondary.failedLabel,
          icon: secondary.icon ?? Trash2,
          destructive: true,
        }]
      : []),
  ];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!wrapRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onViewportMove = () => setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onViewportMove);
    window.addEventListener("scroll", onViewportMove, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onViewportMove);
      window.removeEventListener("scroll", onViewportMove, true);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={menuAriaLabel ?? `More options for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          if (open) {
            setOpen(false);
            return;
          }
          setMenuPosition(positionMenu(
            event.currentTarget.getBoundingClientRect(),
            menuActions.length,
            menuAlign,
          ));
          setOpen(true);
        }}
        className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </button>
      {open && menuPosition && typeof document !== "undefined" ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={menuPosition}
          className="fixed z-[70] overflow-hidden rounded-xl border border-border bg-background py-1 shadow-lg"
        >
          {menuActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  if (action.confirm) {
                    setPendingAction(action);
                    return;
                  }
                  setFailedDirect(null);
                  void action.onRun()
                    .catch(() => false)
                    .then((ok) =>
                      setFailedDirect(ok ? null : action.failedLabel ?? failedLabel),
                    );
                }}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-[14px] transition hover:bg-muted ${
                  action.destructive ? "text-record" : "text-foreground"
                }`}
              >
                {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
                {action.label}
              </button>
            );
          })}
        </div>,
        document.body,
      ) : null}
      {failedDirect ? (
        <p
          role="alert"
          className="absolute right-0 top-full mt-1 whitespace-nowrap text-[12px] text-record"
        >
          {failedDirect}
        </p>
      ) : null}
      {pendingAction?.confirm ? (
        <ConfirmDelete
          copy={pendingAction.confirm}
          onCancel={() => setPendingAction(null)}
          onDelete={pendingAction.onRun}
          onFailure={pendingAction.dismissConfirmationOnFailure
            ? () => {
                setFailedDirect(pendingAction.failedLabel ?? failedLabel);
                setPendingAction(null);
              }
            : undefined}
        />
      ) : null}
    </div>
  );
}

export function ConfirmDelete({
  copy,
  onCancel,
  onDelete,
  onFailure,
}: {
  copy: ConfirmCopy;
  onCancel: () => void;
  onDelete: () => Promise<boolean>;
  onFailure?: () => void;
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
      if (onFailure) {
        onFailure();
        return;
      }
      setFailed(true);
    }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/35 p-4 sm:items-center"
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
            {copy.failedLabel ?? "Couldn't delete. Try again."}
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
            {copy.cancelLabel ?? "Cancel"}
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
    </div>,
    document.body,
  );
}
