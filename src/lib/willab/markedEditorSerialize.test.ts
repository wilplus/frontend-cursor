// @vitest-environment jsdom
/*
STORY    As a speaker, I want opening and saving my Ideal Text without changes to
         send back exactly the text I received, so that my document is never
         silently rewritten.
OUTCOME
  O1  The real editor paints the document, and reading it back gives the same
      bytes, for every marker grammar (bold, underline, italic, accent,
      moment, paragraphs). Never-5: the Ideal Text stays what the speaker
      said; an unchanged save never rewrites it.
PROVES   O1 -> "returns an untouched document byte-for-byte"
WHY      FE-1 acceptance: edit-with-no-changes posts back the text received.
*/
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import MarkedEditor from "@/components/willab/MarkedEditor";
import { serializeEditor } from "./markedEditorSerialize";

/** Mount the real MarkedEditor on `doc` and serialize the DOM it painted. */
function roundTrip(doc: string): string {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    act(() => root.render(createElement(MarkedEditor, { value: doc, onChange: () => undefined })));
    const editable = host.querySelector<HTMLElement>("[contenteditable]");
    expect(editable, "the editor mounted").not.toBeNull();
    expect(editable!.textContent!.length).toBeGreaterThan(0);
    return serializeEditor(editable!);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
}

describe("serializeEditor — the FE-1 round-trip through the real editor", () => {
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
