"use client";

import { useState } from "react";
import type { LoungeMessage } from "@/services/api/loungeMessages";

/* -------------------------------------------------------------------------- */
/*  The notebook's security disclaimer (backend N411, signed 2026-11-03;       */
/*  prototype https://claude.ai/artifact/5X4M3cnSBxX8YcuKFEFY3a).              */
/*                                                                            */
/*  - Above the notebook's ask, the first time: the mic line, then the three  */
/*    grey privacy lines in one bubble, then the ask (backend COPY["ask"]).   */
/*  - Under every message where Will spots something (the Sunday note's case, */
/*    a strength, a strength again, a suggested principle): the short grey    */
/*    line "🔒 Security disclaimer ›". A tap shows the three lines under it.  */
/*  - The backend writes the same line as its own row under every fifth note */
/*    that names someone (``privacy_line: "names"``).                         */
/*  Only a reminder: nothing is offered, changed or deleted.                  */
/* -------------------------------------------------------------------------- */

/** The signed words (N411 items 1, 2). No new words without the founder. */
export const NOTEBOOK_INTRO =
  "🎙 Tap the mic any time and say what's on your mind. It helps you catch negative thinking and self-sabotage. One privacy rule first:";
export const PRIVACY_RULES = [
  "Nothing fragile: health, family, money, address.",
  "We look for patterns, not secrets. Fewer clues, less for hackers.",
  "📓 For journalling try paper notebook 😉",
] as const;
export const PRIVACY_LINE = "🔒 Security disclaimer";
/** The notebook's ask (backend voice_notebook.COPY["ask"], N411). */
export const NOTEBOOK_ASK = "Do you understand the rules and want this feature on?";

type Meta = LoungeMessage["metadata"];

/** A message where Will spots something: the short line goes under it. */
export function isSpotted(meta: Meta): boolean {
  if (!meta) return false;
  return (
    meta.sunday_step === "case" ||
    meta.sunday_step === "suggested" ||
    meta.strength_step === "case" ||
    typeof meta.strength_again === "string"
  );
}

/** The backend's own row of the short line (every fifth named note). */
export function isPrivacyLineRow(meta: Meta): boolean {
  return meta?.privacy_line === "names";
}

/** The notebook's ask as asked since N411: the intro goes above it. An
 *  ask written before keeps its old words and no intro. */
export function isNotebookAsk(message: Pick<LoungeMessage, "role" | "body" | "metadata">): boolean {
  return message.role === "bot" && message.metadata?.offer === "voice_notebook" && message.body === NOTEBOOK_ASK;
}

export function PrivacyRules() {
  return (
    <div
      data-row="app"
      data-bubble=""
      data-privacy-rules=""
      className="mr-auto flex max-w-[85%] flex-col gap-1.5 rounded-2xl bg-muted px-3 py-2 text-[15px] leading-relaxed text-muted-foreground"
    >
      {PRIVACY_RULES.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </div>
  );
}

/** The short grey line; a tap shows the three lines under it, and again. */
export function PrivacyLine() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-privacy-line=""
        aria-expanded={open}
        onClick={() => setOpen((now) => !now)}
        className="mr-auto px-3 pb-1 text-left text-[12px] leading-snug text-muted-foreground transition-colors hover:text-foreground"
      >
        {PRIVACY_LINE} <span aria-hidden>›</span>
      </button>
      {open ? <PrivacyRules /> : null}
    </>
  );
}

/** Above the ask: the mic line, then the three lines. */
export function NotebookIntro() {
  return (
    <>
      <div
        data-row="app"
        data-bubble=""
        className="mr-auto max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-[15px] leading-relaxed text-foreground"
      >
        {NOTEBOOK_INTRO}
      </div>
      <PrivacyRules />
    </>
  );
}
