// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { serializeEditor } from "./markedEditorSerialize";
import {
  parseRichSpans,
  splitSpanParagraphs,
  type RichSpan,
} from "./richMarkers";

/* -------------------------------------------------------------------------- */
/*  FE-1's acceptance criterion, as a test: "Round-trip a document through      */
/*  edit-with-no-changes → text posted back is identical to text received."     */
/*  A rewrite here is not cosmetic — the PUT is the student's document.         */
/* -------------------------------------------------------------------------- */

/** Build the editor's DOM exactly as MarkedEditor paints it. Kept in step with
 *  `paint`; the point of the test is the DOM → markers direction. */
function paintInto(root: HTMLElement, value: string) {
  const paragraphs = splitSpanParagraphs(parseRichSpans(value));
  root.replaceChildren(
    ...(paragraphs.length > 0 ? paragraphs : [[]]).map((spans: RichSpan[]) => {
      const p = document.createElement("p");
      for (const span of spans) {
        const styled = !!span.open && !!span.close;
        if (!styled && !span.moment) {
          p.appendChild(document.createTextNode(span.text));
          continue;
        }
        const el = document.createElement("span");
        el.textContent = span.text;
        if (styled) {
          el.dataset.open = span.open as string;
          el.dataset.close = span.close as string;
        }
        if (span.moment) {
          el.dataset.snippet = span.moment.snippetId;
          el.dataset.session = span.moment.sessionId;
        }
        p.appendChild(el);
      }
      return p;
    })
  );
}

const roundTrip = (doc: string) => {
  const root = document.createElement("div");
  paintInto(root, doc);
  return serializeEditor(root);
};

describe("serializeEditor — the FE-1 round-trip", () => {
  it("returns an untouched document byte-for-byte", () => {
    for (const doc of [
      "plain words",
      "say it **louder** and __clearer__",
      "a //i// and {{orange:an accent}} z",
      "[[moment:s1|k1]]{{orange:this bit}}[[/moment]] louder",
      "one paragraph\n\nand a second\n\nand a third",
      "a [[moment:s|k]]plain **b**[[/moment]] z",
    ]) {
      expect(roundTrip(doc)).toBe(doc);
    }
  });

  it("keeps a legacy spelling rather than rewriting it to the pinned one", () => {
    // Opening the editor on an old document and closing it must not silently
    // restyle every accent in it.
    expect(roundTrip("a ==x== and *i*")).toBe("a ==x== and *i*");
  });

  it("never posts HTML — the save route would strip it and lose the styling", () => {
    expect(roundTrip("say it **louder**")).not.toMatch(/<|>/);
  });
});

describe("serializeEditor — what the user's edits do to the markers", () => {
  it("deleting a styled span deletes its markers with it", () => {
    const root = document.createElement("div");
    paintInto(root, "keep **drop** keep");
    root.querySelector("[data-open]")?.remove();
    expect(serializeEditor(root)).toBe("keep  keep");
  });

  it("a moment keeps its ids on the text that survives an edit", () => {
    const root = document.createElement("div");
    paintInto(root, "a [[moment:s1|k1]]the whole phrase[[/moment]] z");
    const span = root.querySelector<HTMLElement>("[data-snippet]");
    span!.textContent = "the phrase";
    expect(serializeEditor(root)).toBe("a [[moment:s1|k1]]the phrase[[/moment]] z");
  });

  it("deleting a moment span takes the moment with it", () => {
    const root = document.createElement("div");
    paintInto(root, "a [[moment:s1|k1]]gone[[/moment]] z");
    root.querySelector("[data-snippet]")?.remove();
    expect(serializeEditor(root)).not.toContain("[[moment:");
  });

  it("text typed OUTSIDE a span does not join it", () => {
    // The onBeforeInput guard puts the character in a sibling text node; this
    // is what that node then serializes to.
    const root = document.createElement("div");
    paintInto(root, "say {{orange:this}}");
    const span = root.querySelector<HTMLElement>("[data-open]");
    span!.parentNode!.appendChild(document.createTextNode(" and that"));
    expect(serializeEditor(root)).toBe("say {{orange:this}} and that");
  });

  it("flattens a nested style rather than emitting a nested marker", () => {
    // The grammar has no nesting, so an inner span is the outer span's words.
    const root = document.createElement("div");
    const p = document.createElement("p");
    const outer = document.createElement("span");
    outer.dataset.open = "**";
    outer.dataset.close = "**";
    const inner = document.createElement("span");
    inner.dataset.open = "__";
    inner.dataset.close = "__";
    inner.textContent = "inner";
    outer.append(document.createTextNode("a "), inner);
    p.appendChild(outer);
    root.appendChild(p);
    expect(serializeEditor(root)).toBe("**a inner**");
  });

  it("survives a browser-inserted wrapper without losing a word", () => {
    const root = document.createElement("div");
    paintInto(root, "hello **there**");
    const span = root.querySelector<HTMLElement>("[data-open]")!;
    const font = document.createElement("font"); // what execCommand can leave
    font.textContent = span.textContent;
    span.replaceChildren(font);
    expect(serializeEditor(root)).toBe("hello **there**");
  });

  it("turns a non-breaking space back into an ordinary one", () => {
    const root = document.createElement("div");
    const p = document.createElement("p");
    p.textContent = "two words";
    root.appendChild(p);
    expect(serializeEditor(root)).toBe("two words");
  });

  it("a <br> is a soft break, and paragraphs stay blank-line separated", () => {
    const root = document.createElement("div");
    const p1 = document.createElement("p");
    p1.append(document.createTextNode("one"), document.createElement("br"), document.createTextNode("two"));
    const p2 = document.createElement("p");
    p2.textContent = "three";
    root.append(p1, p2);
    expect(serializeEditor(root)).toBe("one\ntwo\n\nthree");
  });

  it("an emptied editor is an empty document, not a crash", () => {
    const root = document.createElement("div");
    expect(serializeEditor(root)).toBe("");
  });
});
