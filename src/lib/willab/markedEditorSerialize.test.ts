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
});
