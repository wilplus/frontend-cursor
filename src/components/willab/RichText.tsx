"use client";

import { Fragment, useMemo } from "react";
import { Bold, Italic, Underline, type LucideIcon } from "lucide-react";
import {
  parseRichSpans,
  wrapSelection,
  type RichMark,
} from "@/lib/willab/richMarkers";
import { readingBlocks } from "@/lib/willab/readingBlocks";

/* -------------------------------------------------------------------------- */
/*  RichText — the ONE renderer for the FE-9 marker contract, shared by the    */
/*  coach ideal-text editor preview, the student best-presentation view, and   */
/*  the student notebook, so the same text paints identically everywhere.      */
/*  (The print/PDF export mirror lives in richMarkersToHtml — keep in step.)   */
/*  MarkerToolbar is the matching editor chrome (B / U / I / orange).          */
/* -------------------------------------------------------------------------- */

/** Render marked text as styled spans.
 *
 *  A key moment ([[moment:…]]) is now just ACCENTED TEXT — no icon, no tap,
 *  no underline (founder 2026-08-11: "no stars anywhere ... rip them off";
 *  underline belongs exclusively to a chunk with feedback waiting). The star
 *  treatment this renderer used to carry — the decor lookup, the icon family
 *  and the optimistic approve-fold — went with the star lane it served; the
 *  transcript review deck is where feedback is decided now. */
export function RichText({
  text,
  srcOffset = 0,
  tint,
}: {
  text: string;
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
        const cls = [
          // An APPROVED key phrase reads bold+orange: that is an accent
          // INSIDE a moment wrapper, which is exactly what the serve-time
          // fold emits. A standalone accent (the coach's orange toolbar
          // button) stays colour-only, so approving never restyles text
          // somebody hand-marked.
          seg.bold || (seg.highlight && seg.moment) ? "font-semibold" : "",
          seg.italic ? "italic" : "",
          seg.underline ? "underline underline-offset-2" : "",
          // An accent ({{orange:…}}) colours; so does a moment wrapper, which
          // is now only an accent by another name. NO underline from either —
          // that signal belongs to a chunk with feedback waiting, and nothing
          // else in the product may borrow it.
          seg.highlight || seg.moment ? "text-primary" : "",
        ]
          .filter(Boolean)
          .join(" ");
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
