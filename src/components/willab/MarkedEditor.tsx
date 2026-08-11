"use client";

import { useCallback, useEffect, useRef } from "react";
import { Bold, Italic, Underline, type LucideIcon } from "lucide-react";
import {
  WRAPPERS,
  parseRichSpans,
  splitSpanParagraphs,
  type RichMark,
  type RichSpan,
} from "@/lib/willab/richMarkers";
import { serializeEditor } from "@/lib/willab/markedEditorSerialize";

/* -------------------------------------------------------------------------- */
/*  MarkedEditor (FE-1) — editing the ideal text WITHOUT seeing the markers    */
/*                                                                            */
/*  The story's second acceptance criterion is the hard one: "text formatting  */
/*  remains consistent in both view and edit modes". This used to be a raw     */
/*  textarea over the marker source, so pressing the pencil showed the user    */
/*  every "{{orange:" the read view had just been fixed to hide.               */
/*                                                                            */
/*  So: a contentEditable that renders the SAME styled spans the reader sees,  */
/*  and serializes back to markers on every keystroke.                        */
/*                                                                            */
/*  A SPAN *IS* ITS TOKEN PAIR. Each styled node carries data-open/data-close  */
/*  — the exact tokens that span was written with, not the mark's canonical    */
/*  spelling. That is the whole trick behind byte-exactness: a legacy ==x==    */
/*  the user never touched serializes back as ==x==, so opening the editor and */
/*  closing it cannot rewrite a document. The save route strips raw HTML and   */
/*  preserves markers, so posting HTML would silently destroy the styling —    */
/*  what leaves here is always marker text.                                   */
/*                                                                            */
/*  Three behaviours the spec pins, and where each lives:                     */
/*    · deleting a styled span deletes its markers with it — free, because the */
/*      markers exist only as attributes on the node being deleted            */
/*    · a [[moment:…]] span keeps its ids attached to the surviving text, and  */
/*      deleting the span takes the moment with it — same reason (the BE       */
/*      re-derives key_moments from the text)                                  */
/*    · typing at a span boundary extends the UNSTYLED side — NOT free. The    */
/*      browser's default is to absorb the new character into the adjacent     */
/*      styled node, which is exactly the "silently swallow new words into an  */
/*      accent" the spec forbids, so `onBeforeInput` intercepts it.           */
/* -------------------------------------------------------------------------- */

const MARK_CLASS: Record<RichMark, string> = {
  bold: "font-semibold",
  italic: "italic",
  underline: "underline underline-offset-2",
  highlight: "text-primary",
};

/** The class a parsed span renders with — the reader's styling exactly, so
 *  view and edit modes cannot look different. */
function classesFor(span: {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  highlight: boolean;
  moment?: unknown;
}): string {
  return [
    span.bold || (span.highlight && span.moment) ? MARK_CLASS.bold : "",
    span.italic ? MARK_CLASS.italic : "",
    span.underline ? MARK_CLASS.underline : "",
    span.highlight || span.moment ? MARK_CLASS.highlight : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/* --------------------------- markers → the DOM ---------------------------- */

function paint(root: HTMLElement, value: string) {
  const paragraphs = splitSpanParagraphs(parseRichSpans(value));
  root.replaceChildren(
    ...(paragraphs.length > 0 ? paragraphs : [[]]).map((spans) => {
      const p = document.createElement("p");
      p.className = "max-w-[65ch] whitespace-pre-line leading-relaxed";
      if (spans.length === 0) p.appendChild(document.createElement("br"));
      for (const span of spans) p.appendChild(node(span));
      return p;
    })
  );
}

function node(span: RichSpan): Node {
  const styled = !!span.open && !!span.close;
  if (!styled && !span.moment) return document.createTextNode(span.text);
  const el = document.createElement("span");
  el.textContent = span.text;
  const cls = classesFor(span);
  if (cls) el.className = cls;
  if (styled) {
    el.dataset.open = span.open as string;
    el.dataset.close = span.close as string;
  }
  if (span.moment) {
    el.dataset.snippet = span.moment.snippetId;
    el.dataset.session = span.moment.sessionId;
  }
  return el;
}

/** Drop `text` into the document at the caret and leave the caret AFTER it.
 *
 *  `outside` places it as a sibling of `span` rather than inside it — that is
 *  the boundary rule. Written with Range rather than document.execCommand:
 *  execCommand normalises whitespace around the insertion point, which quietly
 *  ate a trailing space in testing, and silent content mutation is exactly what
 *  this editor exists to avoid. */
function insertTextAtCaret(
  text: string,
  span?: HTMLElement,
  outside?: "before" | "after"
) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const node = document.createTextNode(text);
  if (span && outside) {
    span.parentNode?.insertBefore(
      node,
      outside === "after" ? span.nextSibling : span
    );
  } else {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);
  }
  const after = document.createRange();
  after.setStart(node, node.length);
  after.collapse(true);
  sel.removeAllRanges();
  sel.addRange(after);
}

/* -------------------------------------------------------------------------- */

export default function MarkedEditor({
  value,
  onChange,
  textSizeClass = "text-[17px]",
  autoFocus = false,
  compact = false,
  toolbar = true,
  frameClass = "border border-primary bg-background",
}: {
  /** The marker text. */
  value: string;
  /** The new marker text after an edit. Never HTML. */
  onChange: (next: string) => void;
  textSizeClass?: string;
  /** Focus on mount — for a surface where entering edit mode IS the gesture. */
  autoFocus?: boolean;
  /** Per-paragraph mode (founder 2026-08-10, chunked editing): the toolbar
   *  shows only while THIS chunk holds focus, so a stack of chunks reads as
   *  one editor with one toolbar — the one beside the caret. */
  compact?: boolean;
  /** The B / U / I / orange row. OFF on the deck's chunk modal, and not for
   *  tidiness: its Underline button would let a student underline their own
   *  words, and underline is RESERVED on the deck for "feedback is waiting on
   *  this chunk" (founder 2026-08-11). A surface that cannot afford a mark
   *  must be able to leave the marker OUT, not merely style around it. */
  toolbar?: boolean;
  /** The box's border + background, so a host can keep its own field styling.
   *  Layout, padding and the paragraph rules are NOT overridable — they carry
   *  the WebKit contentEditable fixes below. */
  frameClass?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // What we last handed the host. Repainting on our own echo would reset the
  // caret to the top of the document on every keystroke, so the DOM is only
  // rebuilt when `value` changes from somewhere ELSE (an accepted tracked
  // change, a served refetch, a swap).
  const emitted = useRef<string | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || value === emitted.current) return;
    paint(root, value);
    emitted.current = value;
  }, [value]);

  // Focus AFTER the first paint, so the caret lands in real content rather
  // than an empty node the effect above is about to replace.
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const emit = useCallback(() => {
    const root = ref.current;
    if (!root) return;
    const next = serializeEditor(root);
    emitted.current = next;
    onChange(next);
  }, [onChange]);

  /** Typing at a styled span's edge must extend the UNSTYLED side.
   *
   *  A NATIVE listener, deliberately. React's `onBeforeInput` is a synthetic
   *  polyfill built on legacy textInput/composition events, NOT the native
   *  `beforeinput`: its nativeEvent carries no `inputType`, so a guard reading
   *  that field returns early on EVERY keystroke and silently does nothing.
   *  This shipped that way and a browser test caught it — typing at the end of
   *  an accent produced "{{orange:wordX}}", which is exactly the swallow the
   *  spec forbids. Anything depending on `inputType` has to bind the real
   *  event. */
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const onBeforeInput = (ev: InputEvent) => {
      // Composition (IME, mobile autocorrect) is left alone: interrupting it
      // mid-word breaks the input method, and the swallow it can cause is a far
      // smaller harm than a keyboard that stops working. A composed word typed
      // at a span's edge therefore still joins the span — a known, accepted
      // gap, not an oversight.
      if (ev.inputType !== "insertText" || !ev.data) return;
      const sel = window.getSelection();
      if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const text = range.startContainer;
      if (text.nodeType !== Node.TEXT_NODE) return;
      const span = text.parentElement;
      if (!span || !span.dataset.open) return; // not inside a styled span
      const atEnd =
        range.startOffset === (text.textContent ?? "").length &&
        text === span.lastChild;
      const atStart = range.startOffset === 0 && text === span.firstChild;
      if (!atEnd && !atStart) return; // interior: the span legitimately grows

      ev.preventDefault();
      insertTextAtCaret(ev.data, span, atEnd ? "after" : "before");
      emit();
    };

    root.addEventListener("beforeinput", onBeforeInput);
    return () => root.removeEventListener("beforeinput", onBeforeInput);
  }, [emit]);

  /** The toolbar's B / U / I / orange. Wrapping the live DOM selection rather
   *  than computing marker offsets: the caret is already the source of truth
   *  here, and offset arithmetic across a styled tree is where the bugs are. */
  const applyMark = useCallback(
    (mark: RichMark) => {
      const root = ref.current;
      const sel = window.getSelection();
      if (!root || !sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return;
      const [open, close] = WRAPPERS[mark];
      const wrapper = document.createElement("span");
      wrapper.dataset.open = open;
      wrapper.dataset.close = close;
      wrapper.className = MARK_CLASS[mark];
      wrapper.appendChild(range.extractContents());
      // The grammar is FLAT, so a style inside the new one is not a nested
      // mark — it is dropped, exactly as the parser would drop it.
      wrapper.querySelectorAll<HTMLElement>("[data-open]").forEach((inner) => {
        if (inner === wrapper) return;
        delete inner.dataset.open;
        delete inner.dataset.close;
      });
      range.insertNode(wrapper);
      sel.removeAllRanges();
      const after = document.createRange();
      after.selectNodeContents(wrapper);
      sel.addRange(after);
      emit();
    },
    [emit]
  );

  return (
    <div className="group flex flex-col gap-2">
      {toolbar ? (
        <div className={compact ? "hidden group-focus-within:block" : undefined}>
          <Toolbar onApply={applyMark} />
        </div>
      ) : null}
      <div
        ref={ref}
        role="textbox"
        aria-multiline
        aria-label="Edit your ideal text"
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        // Paste as plain text: pasted HTML would arrive as tags the save route
        // strips, so the words would land with their styling silently gone.
        onPaste={(e) => {
          e.preventDefault();
          const plain = e.clipboardData.getData("text/plain");
          if (!plain) return;
          insertTextAtCaret(plain);
          emit();
        }}
        /* Task #62 — BLOCK flow, not flex. A contentEditable that is a flex
           container is a known WebKit hazard: text nodes become anonymous flex
           items, a <br> stops breaking lines, and editing restructures blocks
           unpredictably — the paragraph structure the paint just built decays
           from the first keystroke. Paragraph spacing is the sibling margin
           ([&>p+p]:mt-4, the old gap-4), and whitespace-pre-line on the root
           keeps line breaks visible even when the browser leaves bare text
           nodes outside any <p> (select-all-then-type). */
        className={`block w-full whitespace-pre-line rounded-2xl px-4 py-4 outline-none [&>p+p]:mt-4 ${frameClass} ${textSizeClass}`}
      />
    </div>
  );
}

const TOOLBAR: Array<{ mark: RichMark; label: string; Icon: LucideIcon | null }> = [
  { mark: "bold", label: "Bold", Icon: Bold },
  { mark: "underline", label: "Underline", Icon: Underline },
  { mark: "italic", label: "Italic", Icon: Italic },
  // The one colour — a plain orange dot reads clearer than a letter.
  { mark: "highlight", label: "Orange accent", Icon: null },
];

/** Buttons fire on mousedown with preventDefault so the editor keeps focus AND
 *  its selection (a click would collapse the range before the wrap landed). */
function Toolbar({ onApply }: { onApply: (mark: RichMark) => void }) {
  return (
    <div className="flex items-center gap-0.5 self-start rounded-lg border border-border bg-background px-1 py-0.5">
      {TOOLBAR.map(({ mark, label, Icon }) => (
        <button
          key={mark}
          type="button"
          aria-label={label}
          onMouseDown={(e) => {
            e.preventDefault();
            onApply(mark);
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
