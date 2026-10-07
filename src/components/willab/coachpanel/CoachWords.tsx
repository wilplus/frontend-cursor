"use client";

/* -------------------------------------------------------------------------- */
/*  The coach's words, exactly where the speaker reads them, with the pencil  */
/*  (founder lock 2026-10-06, flow step 8; "the pencil edits every word").    */
/*                                                                            */
/*  The Feedback walk's message (the grey profile picture, plain black text,  */
/*  no sender label) with a pencil in its top-right corner. Tapped, the text  */
/*  becomes a field with a black edge and the pencil a tick; tapped again,    */
/*  the words stand as edited. Nothing here is a word of its own: the labels  */
/*  are COACH_PANEL_COPY's.                                                   */
/* -------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import { Check, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { WalkAvatar } from "../walk/WalkMessage";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";

export default function CoachWords({ text, editing, onChange, onToggle, children }: {
  text: string;
  editing: boolean;
  onChange: (text: string) => void;
  /** The pencil: edit, or done editing. */
  onToggle: () => void;
  /** The words as shown while not editing, when they are not plain text (the
   *  clearer version's new words in orange). */
  children?: ReactNode;
}) {
  return (
    <div
      data-coach-words
      data-editing={editing ? "true" : undefined}
      className={cn(
        "relative -m-2.5 flex items-start gap-2.5 rounded-2xl border-[1.5px] border-dashed border-transparent p-2.5 pr-10 text-[17px] leading-[1.55] text-foreground transition-colors",
        editing && "border-solid border-foreground bg-background",
      )}
    >
      <WalkAvatar />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        {editing ? (
          <textarea
            data-coach-words-field
            aria-label={COPY.yourWords}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[110px] w-full resize-none border-0 bg-transparent p-0 text-[17px] leading-[1.55] text-foreground outline-none"
          />
        ) : (
          children ?? <span>{text}</span>
        )}
      </div>
      <button
        type="button"
        data-coach-words-pencil
        aria-label={editing ? COPY.doneEditing : COPY.edit}
        onClick={onToggle}
        className={cn(
          "walk-press-sm absolute right-1.5 top-1.5 flex h-[30px] w-[30px] items-center justify-center rounded-full",
          editing ? "bg-foreground text-background" : "bg-muted text-foreground",
        )}
      >
        {editing ? <Check className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden /> : <Pencil className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden />}
      </button>
    </div>
  );
}
