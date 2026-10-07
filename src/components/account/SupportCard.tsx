"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/appMenuLinks";

/* -------------------------------------------------------------------------- */
/*  Support, moved here from the ☰ menu (founder 2026-10-07: "remove the       */
/*  support from the hamburger and add it to the settings page with just an   */
/*  email to contact@willpowerlab.com"; ST1 A, N60).                          */
/*                                                                            */
/*  Exactly as the settings prototype's supportCard draws it (founder         */
/*  2026-10-07, Q-B14 A (5); build plan D-CS-7): the h2, then the address as  */
/*  plain selectable text — no underline, no mail link — and beside it a      */
/*  36px round bordered copy button. The button writes the address to the    */
/*  clipboard and shows a check for 1.6 s; where the clipboard is refused,   */
/*  the address is selected instead so it can be copied by hand (the         */
/*  prototype's copyAddress). No other visible word: the prototype's fallback */
/*  toasts were not signed and are not built.                                 */
/* -------------------------------------------------------------------------- */

export const SUPPORT_TITLE = "Support";

/** How long the check stays after a copy (the prototype's 1600). */
export const COPIED_MS = 1600;

/** Select the address so a person can copy it by hand. */
function selectAddress(node: HTMLElement | null): void {
  if (!node) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
}

export default function SupportCard() {
  const [copied, setCopied] = useState(false);
  const addressRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
      if (!clipboard?.writeText) throw new Error("no clipboard");
      await clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
    } catch {
      selectAddress(addressRef.current);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-border p-5" aria-label={SUPPORT_TITLE}>
      <h2 className="text-base font-semibold">{SUPPORT_TITLE}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          ref={addressRef}
          data-support-address
          className="cursor-text select-all break-all text-sm leading-[1.625]"
        >
          {SUPPORT_EMAIL}
        </span>
        <button
          type="button"
          aria-label="Copy"
          data-support-copy
          data-copied={copied ? "true" : undefined}
          onClick={() => void copy()}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted"
        >
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </section>
  );
}
