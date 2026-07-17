"use client";

import { useMemo } from "react";
import { Bold, Italic, Underline, type LucideIcon } from "lucide-react";
import {
  parseRichMarkers,
  wrapSelection,
  type RichMark,
} from "@/lib/willab/richMarkers";

/* -------------------------------------------------------------------------- */
/*  RichText — the ONE renderer for the FE-9 marker contract, shared by the    */
/*  coach ideal-text editor preview, the student best-presentation view, and   */
/*  the student notebook, so the same text paints identically everywhere.      */
/*  (The print/PDF export mirror lives in richMarkersToHtml — keep in step.)   */
/*  MarkerToolbar is the matching editor chrome (B / U / I / orange).          */
/* -------------------------------------------------------------------------- */

/** Render marked text as styled spans. A key moment ([[moment:…]]) becomes a
 *  tappable button (orange dotted underline) when `onMomentTap` is provided;
 *  WITHOUT a handler it renders as plain orange text — never underlined, so a
 *  surface with no moment flow doesn't paint a dead link-looking affordance. */
export function RichText({
  text,
  onMomentTap,
}: {
  text: string;
  onMomentTap?: (moment: { snippetId: string; sessionId: string }) => void;
}) {
  const segments = useMemo(() => parseRichMarkers(text), [text]);
  return (
    <>
      {segments.map((seg, i) => {
        const cls = [
          seg.bold ? "font-semibold" : "",
          seg.italic ? "italic" : "",
          seg.underline ? "underline underline-offset-2" : "",
          seg.highlight || seg.moment ? "text-primary" : "",
          seg.moment && onMomentTap
            ? "underline decoration-dotted decoration-2 underline-offset-4"
            : "",
        ]
          .filter(Boolean)
          .join(" ");
        if (seg.moment && onMomentTap) {
          const m = seg.moment;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onMomentTap(m)}
              className={`inline transition-colors hover:opacity-80 ${cls}`}
            >
              {seg.text}
            </button>
          );
        }
        return (
          <span key={i} className={cls || undefined}>
            {seg.text}
          </span>
        );
      })}
    </>
  );
}

/** The B / U / I / orange formatting bar (FE-9 — the same options the student
 *  gets). Wraps the textarea's current selection in the pinned markers. Buttons
 *  fire on mousedown with preventDefault so the textarea keeps focus AND its
 *  selection (a click would blur the editor before the wrap landed). */
const TOOLBAR_MARKS: Array<{
  mark: RichMark;
  label: string;
  Icon: LucideIcon | null;
}> = [
  { mark: "bold", label: "Bold", Icon: Bold },
  { mark: "underline", label: "Underline", Icon: Underline },
  { mark: "italic", label: "Italic", Icon: Italic },
  // The one color — a plain orange dot reads clearer than a letter.
  { mark: "highlight", label: "Orange accent", Icon: null },
];

export function MarkerToolbar({
  textareaRef,
  value,
  onChange,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
}) {
  function apply(mark: RichMark) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    const r = wrapSelection(value, selectionStart, selectionEnd, mark);
    if (r.text === value) return; // collapsed selection — nothing to wrap
    onChange(r.text);
    // Restore the (shifted) selection once React has committed the new value.
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(r.selStart, r.selEnd);
    });
  }

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background px-1 py-0.5">
      {TOOLBAR_MARKS.map(({ mark, label, Icon }) => (
        <button
          key={mark}
          type="button"
          aria-label={label}
          onMouseDown={(e) => {
            e.preventDefault();
            apply(mark);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {Icon ? (
            <Icon className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <span className="h-3 w-3 rounded-full bg-primary" aria-hidden />
          )}
        </button>
      ))}
    </div>
  );
}
