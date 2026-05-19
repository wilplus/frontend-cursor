"use client";

import { Loader2, Send } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  TextComposer — text-only slot (no mic, no paperclip)                      */
/*                                                                            */
/*  The "type a question" answer mode. Single-line input + circular send    */
/*  pill. Enter submits, empty input is blocked, send button disables       */
/*  while a parent send is in flight. Strictly text — for the dual-capture */
/*  (mic + text) composer use ChatInputBar instead; this slot is the        */
/*  no-other-modes variant for surfaces where voice/upload aren't options.  */
/* -------------------------------------------------------------------------- */

export interface TextComposerProps {
  /** Called with the trimmed text on submit. */
  onSubmit: (text: string) => void;
  /** True while the parent send is in flight — disables both input + button. */
  submitting?: boolean;
  /** Placeholder copy. Default: "Type your answer…". */
  placeholder?: string;
}

export function TextComposer({
  onSubmit,
  submitting = false,
  placeholder = "Type your answer…",
}: TextComposerProps) {
  const [value, setValue] = useState("");

  const send = () => {
    const trimmed = value.trim();
    if (!trimmed || submitting) return;
    onSubmit(trimmed);
    setValue("");
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const empty = value.trim().length === 0;
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        disabled={submitting}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          "flex-1 h-12 rounded-full bg-muted px-4 text-[15px] text-foreground",
          "placeholder:text-muted-foreground outline-none transition-shadow",
          "focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
        )}
      />
      <button
        type="button"
        onClick={send}
        disabled={submitting || empty}
        aria-label="Send"
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground transition-transform",
          "active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        {submitting ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <Send className="h-5 w-5" aria-hidden />
        )}
      </button>
    </div>
  );
}
