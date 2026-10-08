import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADMIN_CORPUS_COPY, requestFailedLine } from "./adminCorpusCopy";

/* The founder signed these words on 8 October 2026 (decisions log N66.1).
 * A change here is a change of signed copy: it needs his word first. */
const SIGNED_N66_1 = [
  "Training corpus",
  "Every import, hidden ones included. Hiding takes an import out of the coaches' list; its moments, labels and audio stay.",
  "Couldn't load the corpus just now. Reload to try again.",
  "Nothing imported yet.",
  "Untitled",
  "No speaker label",
  "Auto-detected",
  "set-up not finished",
  "hidden",
  "Restore",
  "Hide",
  "Request failed (HTTP {status}).",
];

describe("/admin/corpus says only the words the founder signed (N66.1)", () => {
  it("the copy is exactly the signed list", () => {
    expect(Object.values(ADMIN_CORPUS_COPY)).toEqual(SIGNED_N66_1);
  });

  it("the page carries no literal word of its own", () => {
    const page = readFileSync("src/app/admin/corpus/page.client.tsx", "utf8");
    const code = page.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    // Text between JSX tags, other than an expression, is a literal word.
    expect(code).not.toMatch(/>\s*[A-Za-z][^<{]*</);
    for (const word of SIGNED_N66_1) {
      expect(code, word).not.toContain(`"${word}"`);
    }
  });

  it("a failed request names its status", () => {
    expect(requestFailedLine(409)).toBe("Request failed (HTTP 409).");
  });
});
