"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  History,
  Loader2,
  MoreHorizontal,
  Presentation,
  Save,
} from "lucide-react";
import { BLOCK_VARIANT_COPY } from "./blockVariantCopy";
import { useSaveIdealText } from "./useSaveIdealText";

/* -------------------------------------------------------------------------- */
/*  IdealTextMenu — the header's one ⋯ (founder 2026-09-26, Ideal Text        */
/*  redesign B).                                                              */
/*                                                                            */
/*  The header used to carry five icon buttons — Presentation Mode, Export,   */
/*  Version history, Copy — and none of them is part of the review loop. On a */
/*  phone their labels hid and they read as a row of unlabelled circles. They */
/*  live here now, with "Save the ideal text", which moved off the bottom so  */
/*  the bottom holds exactly one next step.                                   */
/*                                                                            */
/*  Every label is copy the product already shipped. AC-9: nothing numeric.   */
/* -------------------------------------------------------------------------- */

const ITEM =
  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] text-foreground transition-colors hover:bg-muted disabled:opacity-60";

export default function IdealTextMenu({
  arcId,
  saved,
  onSaved,
  onBeforeSave,
  onPresent = null,
  onExport = null,
  onHistory = null,
  onCopy,
  copied,
}: {
  arcId: string;
  /** null = the save lane is not served — the item is withheld. */
  saved: boolean | null;
  onSaved: () => void;
  /** Drain a pending local edit before the freeze (R-md1). */
  onBeforeSave?: () => Promise<boolean>;
  /** null = this mount has no Presentation Mode (the post-take readout). */
  onPresent?: (() => void) | null;
  /** null = this mount has no export. */
  onExport?: (() => void) | null;
  /** null = no revisions yet — the item is withheld (§4.3). */
  onHistory?: (() => void) | null;
  onCopy: () => void;
  copied: boolean;
}) {
  const [open, setOpen] = useState(false);
  const saver = useSaveIdealText({ arcId, saved, onSaved, onBeforeSave });

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-2xl border border-border bg-background py-1.5 shadow-xl"
          >
            {onPresent ? (
              <button type="button" role="menuitem" aria-label="Use Presentation Mode" onClick={run(onPresent)} className={ITEM}>
                <Presentation className="h-4 w-4 text-muted-foreground" aria-hidden />
                Presentation Mode
              </button>
            ) : null}
            {onExport ? (
              <button type="button" role="menuitem" aria-label="Export" onClick={run(onExport)} className={ITEM}>
                <Download className="h-4 w-4 text-muted-foreground" aria-hidden />
                Export
              </button>
            ) : null}
            {onHistory ? (
              <button type="button" role="menuitem" onClick={run(onHistory)} className={ITEM}>
                <History className="h-4 w-4 text-muted-foreground" aria-hidden />
                {BLOCK_VARIANT_COPY.timelineEntry}
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              aria-label={copied ? "Copied" : "Copy the text"}
              onClick={onCopy}
              className={ITEM}
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" aria-hidden />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" aria-hidden />
              )}
              {copied ? "Copied" : "Copy the text"}
            </button>
            <SaveItem saved={saved} saver={saver} />
          </div>
        </>
      ) : null}
    </div>
  );
}

/** "Save the ideal text", or the fact that it is saved. Withheld while the
 *  lane is not served (saved === null). */
function SaveItem({
  saved,
  saver,
}: {
  saved: boolean | null;
  saver: ReturnType<typeof useSaveIdealText>;
}) {
  if (saved === null) return null;
  if (saved) {
    return (
      <p className="flex items-center gap-3 border-t border-border px-4 py-2.5 text-[13px] text-muted-foreground">
        <Check className="h-4 w-4 text-success" aria-hidden />
        Saved. This is your script.
      </p>
    );
  }
  return (
    <div className="border-t border-border">
      <button
        type="button"
        role="menuitem"
        disabled={saver.busy}
        onClick={() => void saver.save()}
        className={ITEM}
      >
        {saver.busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Save className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
        {saver.busy ? "Saving…" : "Save the ideal text"}
      </button>
      {saver.failed ? (
        <p className="px-4 pb-2 text-[12px] text-muted-foreground">
          Couldn&apos;t save that just now. Give it another go.
        </p>
      ) : null}
    </div>
  );
}

/** One quiet line under the header while the Manager's feedback is still
 *  arriving (founder 2026-09-26, replacing a spinner at the end of every
 *  paragraph). It says only "not finished yet"; it cannot say whether any
 *  paragraph will get a mark. Still under reduced motion. */
export function FeedbackLoadingLine({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      data-feedback-loading
      aria-hidden
      className="relative h-0.5 shrink-0 overflow-hidden bg-muted"
    >
      <div className="absolute inset-y-0 left-0 w-2/5 bg-muted-foreground/50 motion-safe:animate-[feedback-line_1.4s_ease-in-out_infinite]" />
    </div>
  );
}
