"use client";

import { Fragment, useMemo } from "react";
import { Bold, Italic, Star, Underline, type LucideIcon } from "lucide-react";
import {
  parseRichSpans,
  wrapSelection,
  type RichMark,
} from "@/lib/willab/richMarkers";
import { readingBlocks } from "@/lib/willab/readingBlocks";

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
  srcOffset = 0,
  tint,
}: {
  text: string;
  onMomentTap?: (moment: { snippetId: string; sessionId: string }) => void;
  momentDecor?: (moment: {
    snippetId: string;
    sessionId: string;
  }) => MomentDecor | null;
  /** FE-7 — where `text` begins inside the WHOLE served document. Callers that
   *  render a slice pass its absolute start so key-point offsets (which index
   *  the served text, markers included) can be resolved here. Omitted → 0,
   *  which is right for a caller rendering the whole document and harmless for
   *  one that simply doesn't tint. */
  srcOffset?: number;
  /** FE-7 — document-absolute [start, end) ranges to paint in the accent. The
   *  SAME orange {{orange:…}} uses: there is one accent colour in the product,
   *  and a key point is a qualitative cue, never a rank. */
  tint?: Array<[number, number]>;
}) {
  const segments = useMemo(() => parseRichSpans(text), [text]);
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
                <Spaced
                  text={seg.text}
                  absStart={srcOffset + seg.srcStart}
                  tint={tint}
                />
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
            <Spaced
              text={seg.text}
              absStart={srcOffset + seg.srcStart}
              tint={tint}
            />
          </span>
        );
      })}
    </>
  );
}

/** Founder 2026-07-27 — draw a run as spaced reading blocks: a gap between
 *  the document's blocks, and another wherever a block would run well past
 *  five lines.
 *
 *  The gap is a "\n\n" TEXT NODE rather than a margin or a <br>, for two
 *  reasons. The reading containers are `white-space: pre-line`, so a blank
 *  line is exactly a blank line there. And it is inline, so it works unchanged
 *  inside a key-moment <button> — which matters, because the backend wraps
 *  whole paragraphs in [[moment:…]], so the blocks that most need spacing are
 *  usually inside one.
 *
 *  Nothing here edits the run: each block carries its own source offset, so the
 *  key-point tint still resolves against the served text. Inserting whitespace
 *  into the text instead would slide every offset after it. */
function Spaced({
  text,
  absStart,
  tint,
}: {
  text: string;
  absStart: number;
  tint?: Array<[number, number]>;
}) {
  const blocks = readingBlocks(text);
  if (blocks.length <= 1) {
    return <Tinted text={text} absStart={absStart} tint={tint} />;
  }
  return (
    <>
      {blocks.map((b, i) => (
        <Fragment key={i}>
          {i > 0 ? "\n\n" : null}
          <Tinted text={b.text} absStart={absStart + b.offset} tint={tint} />
        </Fragment>
      ))}
    </>
  );
}

/** FE-7 — paint the key-point ranges that fall inside this run.
 *
 *  The ranges are document-absolute and index the SERVED text (markers
 *  included), which is why they are resolved against each span's source
 *  offsets rather than against the marker-stripped string: computing them on
 *  the stripped text would slide every cue left by the width of the markers
 *  before it.
 *
 *  No tint, or nothing overlapping → the text itself, so a run pays nothing
 *  for a document with no cues. */
function Tinted({
  text,
  absStart,
  tint,
}: {
  text: string;
  absStart: number;
  tint?: Array<[number, number]>;
}) {
  if (!tint || tint.length === 0) return <>{text}</>;
  const end = absStart + text.length;
  const hits = tint
    .filter(([s, e]) => s < end && e > absStart)
    .sort((a, b) => a[0] - b[0]);
  if (hits.length === 0) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let at = 0;
  hits.forEach(([s, e], k) => {
    const from = Math.max(0, s - absStart);
    const to = Math.min(text.length, e - absStart);
    if (to <= at) return; // fully consumed by an earlier, overlapping cue
    if (from > at) out.push(<Fragment key={`p${k}`}>{text.slice(at, from)}</Fragment>);
    out.push(
      <span key={`t${k}`} className="text-primary">
        {text.slice(Math.max(at, from), to)}
      </span>
    );
    at = to;
  });
  if (at < text.length) out.push(<Fragment key="rest">{text.slice(at)}</Fragment>);
  return <>{out}</>;
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
