import { describe, expect, it } from "vitest";
import {
  parseRichMarkers,
} from "./richMarkers";

/** Every token of the five grammars, which FE-1 forbids at the reader. Note
 *  it does NOT include a bare "[[" or "]]": those are ordinary characters a
 *  speaker may well have said, and rule 3 is about tokens "from this grammar",
 *  not about confiscating brackets. */
const FORBIDDEN = /\*\*|__|\/\/|\{\{orange:|\}\}|\[\[moment:|\[\[\/moment\]\]|==/;
const rendered = (t: string) =>
  parseRichMarkers(t)
    .map((s) => s.text)
    .join("");

describe("FE-1 rule 3 — an unmatched opener is never shown", () => {

  it("no grammar character survives, whatever the malformation", () => {
    for (const doc of [
      "**",
      "}}{{orange:",
      "[[moment:]]x[[/moment]]",
      "**a __b //c {{orange:d",
      "==x",
      "{{orange:a}}}}",
      "[[moment:s1|k1]]a[[moment:s2|k2]]b[[/moment]]",
    ]) {
      expect(FORBIDDEN.test(rendered(doc))).toBe(false);
    }
  });
});
