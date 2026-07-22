"use client";

import { useMemo } from "react";
import { Bold, Italic, Star, Underline, type LucideIcon } from "lucide-react";
import {
  parseRichMarkers,
  wrapSelection,
  type RichMark,
} from "@/lib/willab/richMarkers";

/** FE-2 (gradual refinement) — how a [[moment:…]] span should decorate in the
 *  SD star treatment. `star` picks the icon family; `quote` is the narrow
 *  substring to underline inside the span (null → icon only, NO underline).
 *  Returned by the host's lookup; a null RETURN means the moment is not in the
 *  current payload (consumed/baked) → plain text, no icon, not tappable. */
export interface MomentDecor {
  star: "suggestion" | "verified" | "practice" | null;
  quote: string | null;
  /** A just-approved suggestion's optimistic local fold: render THIS instead
   *  of the run's original text (emphasize → bold+orange marker, replace →
   *  the rephrase), star-less and non-tappable, until the BE refetch bakes
   *  it. Absent/null → render the run normally. */
  fold?: { kind: "emphasize" | "replace"; text: string } | null;
}

const STAR_STYLE: Record<
  NonNullable<MomentDecor["star"]> | "plain",
  { cls: string; fill: boolean; label: string } | null
> = {
  // The ONLY filled star in the app: the coach verified this.
  verified: { cls: "text-yellow-400", fill: true, label: "Coach-verified moment" },
  // Every unverified suggestion reads the same — an empty star. The kind
  // (text / delivery / structural / tracked change) never changes the icon;
  // the BE's `star` field is the whole vocabulary (founder 2026-07-22).
  practice: {
    cls: "text-muted-foreground",
    fill: false,
    label: "Practice suggestion",
  },
  suggestion: {
    cls: "text-muted-foreground",
    fill: false,
    label: "Suggested edit",
  },
  // No star value → no star at all.
  plain: null,
};

/* -------------------------------------------------------------------------- */
/*  RichText — the ONE renderer for the FE-9 marker contract, shared by the    */
/*  coach ideal-text editor preview, the student best-presentation view, and   */
/*  the student notebook, so the same text paints identically everywhere.      */
/*  (The print/PDF export mirror lives in richMarkersToHtml — keep in step.)   */
/*  MarkerToolbar is the matching editor chrome (B / U / I / orange).          */
/* -------------------------------------------------------------------------- */

/** Render marked text as styled spans. A key moment ([[moment:…]]) becomes a
 *  tappable button when `onMomentTap` is provided; WITHOUT a handler it renders
 *  as plain orange text — never underlined, so a surface with no moment flow
 *  doesn't paint a dead link-looking affordance.
 *
 *  Two moment treatments (FE-2, gradual refinement):
 *  - WITHOUT `momentDecor` (coach editor preview, best-presentation): the
 *    classic orange dotted underline over the whole span — those are
 *    hand-placed links, and the underline is their affordance.
 *  - WITH `momentDecor` (the SD ideal text, where the BE wraps every key
 *    moment and spans run whole paragraphs): NO span underline ever — the
 *    star icon at the end of the span is the affordance, and only the narrow
 *    `quote` substring (if any) is underlined. A null decor return renders
 *    plain text: the moment is not in the current payload (baked/consumed),
 *    so there is nothing to open. */
export function RichText({
  text,
  onMomentTap,
  momentDecor,
}: {
  text: string;
  onMomentTap?: (moment: { snippetId: string; sessionId: string }) => void;
  momentDecor?: (moment: {
    snippetId: string;
    sessionId: string;
  }) => MomentDecor | null;
}) {
  const segments = useMemo(() => parseRichMarkers(text), [text]);
  return (
    <>
      {segments.map((seg, i) => {
        const decor =
          momentDecor && seg.moment ? momentDecor(seg.moment) : undefined;
        const sdMoment = decor !== undefined; // the SD star treatment applies
        const cls = [
          // An APPROVED key phrase reads bold+orange: that is an accent
          // INSIDE a moment wrapper, which is exactly what the serve-time
          // fold emits. A standalone accent (the coach's orange toolbar
          // button) stays colour-only, so approving never restyles text
          // somebody hand-marked.
          seg.bold || (seg.highlight && seg.moment) ? "font-semibold" : "",
          seg.italic ? "italic" : "",
          seg.underline ? "underline underline-offset-2" : "",
          // Under the star treatment moment-ness itself adds NO colour — only
          // a real accent ({{orange:…}}) does. Elsewhere: today's behavior.
          seg.highlight || (seg.moment && !sdMoment) ? "text-primary" : "",
          seg.moment && onMomentTap && !sdMoment
            ? "underline decoration-dotted decoration-2 underline-offset-4"
            : "",
        ]
          .filter(Boolean)
          .join(" ");
        // The star sits after the LAST segment of a moment run (inner marks
        // split one wrapper into several segments sharing the same `moment`
        // object, so reference identity marks the run's end / start).
        const runEnd =
          seg.moment !== undefined && segments[i + 1]?.moment !== seg.moment;
        const runStart =
          seg.moment !== undefined && segments[i - 1]?.moment !== seg.moment;
        // A just-approved suggestion's optimistic fold replaces the WHOLE run:
        // render the fold once at the run's start (emphasize = bold+orange via
        // its marker, replace = the plain rephrase — mirrors the anchor path),
        // star-less and non-tappable; swallow the run's remaining segments.
        // Undo restores decor.fold to null and the original run returns.
        if (seg.moment && decor?.fold) {
          if (!runStart) return null;
          return decor.fold.kind === "emphasize" ? (
            <strong key={i} className="font-semibold">
              <RichText text={decor.fold.text} />
            </strong>
          ) : (
            <span key={i}>
              <RichText text={decor.fold.text} />
            </span>
          );
        }
        if (seg.moment && onMomentTap && (!sdMoment || decor !== null)) {
          const m = seg.moment;
          const style = decor ? STAR_STYLE[decor.star ?? "plain"] : null;
          // Underline the quote in at most ONE segment per run (the first that
          // contains it) — the BE pins one exact spot, and a repeated phrase
          // must not paint twice. Pure lookback keeps rendering idempotent.
          const paintQuote =
            !!decor?.quote &&
            seg.text.includes(decor.quote) &&
            !segments.some(
              (p, j) =>
                j < i &&
                p.moment === seg.moment &&
                p.text.includes(decor.quote as string)
            );
          return (
            <button
              key={i}
              type="button"
              onClick={() => onMomentTap(m)}
              // No aria-label here: it would REPLACE the button's accessible
              // name and erase the whole paragraph for screen readers. The
              // content names the button; the sr-only suffix adds the family.
              className={`inline transition-colors ${
                sdMoment ? "text-left hover:opacity-80" : "hover:opacity-80"
              } ${cls}`}
            >
              {paintQuote && decor?.quote ? (
                <QuoteUnderlined text={seg.text} quote={decor.quote} />
              ) : (
                seg.text
              )}
              {style && runEnd ? (
                <>
                  <Star
                    className={`ml-0.5 inline h-3.5 w-3.5 -translate-y-1.5 ${style.cls}`}
                    fill={style.fill ? "currentColor" : "none"}
                    aria-hidden
                  />
                  <span className="sr-only">, {style.label}</span>
                </>
              ) : null}
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

/** FE-2 — underline exactly the quote substring inside a moment segment's
 *  (already marker-free) text. Not found in THIS segment → plain text; a quote
 *  split across segments by an inner mark degrades to icon-only, by design. */
function QuoteUnderlined({ text, quote }: { text: string; quote: string }) {
  const at = text.indexOf(quote);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="underline decoration-2 underline-offset-4">{quote}</span>
      {text.slice(at + quote.length)}
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
