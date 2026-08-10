"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarkedEditor from "./MarkedEditor";
import { IDEAL_EDIT_COPY } from "./idealEditCopy";
import {
  insertPart,
  movePart,
  updatePart,
  type Part,
} from "@/lib/willab/documentParts";

/* -------------------------------------------------------------------------- */
/*  ChunkedEditor — the edit mode, per paragraph (founder 2026-08-10:          */
/*  "when I click edit, it still is not chunked into paragraphs for editing"   */
/*  + "this state is not necessary — the last one for changing the order of    */
/*  the text chunks").                                                        */
/*                                                                            */
/*  One editor per Part, in document order — each chunk is a full              */
/*  MarkedEditor (markers, toolbar-on-focus), so editing a paragraph is       */
/*  editing THE paragraph, not hunting a position inside one big textarea.     */
/*  The separate arrange state retires; what survives of it lives here:       */
/*  move up / move down and the add-a-part gap, all against the SAME Part      */
/*  operations the arranger used, so ids (and with them locks) ride through    */
/*  every operation unchanged. Removing a chunk is emptying it (updatePart's   */
/*  existing semantics) or its ✕.                                             */
/*                                                                            */
/*  Every change reports the WHOLE next parts list; the host joins it to the   */
/*  document and runs the one save lane (auto-lock "typed = committed"        */
/*  included — that path reads the parts this component hands back).          */
/* -------------------------------------------------------------------------- */

export default function ChunkedEditor({
  parts,
  onChange,
  textSizeClass = "text-[17px]",
}: {
  parts: readonly Part[];
  /** The whole next list after any operation — edit, move, add, remove. */
  onChange: (next: Part[]) => void;
  textSizeClass?: string;
}) {
  // The one open add-gap (index = insert position), with its draft.
  const [addAt, setAddAt] = useState<number | null>(null);
  const [addDraft, setAddDraft] = useState("");

  const list = parts as Part[];

  const gap = (at: number) =>
    addAt === at ? (
      <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-primary/40 p-3">
        <textarea
          autoFocus
          value={addDraft}
          onChange={(e) => setAddDraft(e.target.value)}
          rows={2}
          placeholder={IDEAL_EDIT_COPY.addPlaceholder}
          className="scrollbar-none w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-full px-3 text-[13px]"
            onClick={() => {
              const next = insertPart(list, at, addDraft);
              setAddAt(null);
              setAddDraft("");
              if (next !== list) onChange(next);
            }}
          >
            {IDEAL_EDIT_COPY.addConfirm}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-full px-3 text-[13px]"
            onClick={() => {
              setAddAt(null);
              setAddDraft("");
            }}
          >
            {IDEAL_EDIT_COPY.addCancel}
          </Button>
        </div>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => {
          setAddAt(at);
          setAddDraft("");
        }}
        aria-label={IDEAL_EDIT_COPY.addHere}
        className="flex h-6 w-6 items-center justify-center self-start rounded-full text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </button>
    );

  return (
    <div className="flex flex-col gap-2">
      {gap(0)}
      {list.map((part, i) => (
        <div key={part.id} className="flex flex-col gap-2">
          <div className="flex items-start gap-1.5">
            <div className="min-w-0 flex-1">
              <MarkedEditor
                compact
                value={part.text}
                onChange={(t) => onChange(updatePart(list, i, t))}
                textSizeClass={textSizeClass}
              />
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1 pt-2">
              <button
                type="button"
                onClick={() => {
                  const next = movePart(list, i, i - 1);
                  if (next !== list) onChange(next);
                }}
                disabled={i === 0}
                aria-label={IDEAL_EDIT_COPY.moveUp}
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
              >
                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = movePart(list, i, i + 1);
                  if (next !== list) onChange(next);
                }}
                disabled={i === list.length - 1}
                aria-label={IDEAL_EDIT_COPY.moveDown}
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
              >
                <ArrowDown className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onChange(updatePart(list, i, ""))}
                aria-label={IDEAL_EDIT_COPY.removePart}
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
          {gap(i + 1)}
        </div>
      ))}
    </div>
  );
}
