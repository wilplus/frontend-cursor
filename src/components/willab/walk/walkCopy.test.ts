/*
GUARD    Every word the walk can show comes from the signed copy, and no signed
         walk line carries a digit.
CATCHES  Never 4: a literal word typed into a walk/*.tsx primitive (JSX text,
         a string child, an accessible name, title, placeholder) that is not in
         WALK_COPY or CHUNK_SHEET_COPY. Never 1: a digit in a signed walk line
         (the only numbers the walk shows are a Take or moment position, put in
         by the caller).
IF REMOVED  An unsigned word or a number can reach speakers in the Feedback walk.
PROVES   unsigned word -> "every literal a primitive shows or reads out is signed"
         digit         -> "no signed walk line carries a digit"
*/
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { CHUNK_SHEET_COPY, WALK_COPY } from "../idealEditCopy";

const DIR = "src/components/willab/walk";
const FILES = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
const SPOKEN_ATTRS = new Set(["aria-label", "title", "placeholder", "alt", "label", "aria-description"]);

/** Every string value in a copy object, functions called with a sample. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function") return [String((value as (x: unknown) => unknown)("x"))];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}
const SIGNED = new Set([...strings(CHUNK_SHEET_COPY), ...strings(WALK_COPY)]);

type Found = { file: string; text: string; where: string };

function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(" ");
  return null;
}

/** The user-facing literals of one file. */
function spoken(file: string, text = readFileSync(join(DIR, file), "utf8")): Found[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Found[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && node.text.trim()) out.push({ file, text: node.text.trim(), where: "jsx text" });
    if (ts.isJsxExpression(node) && node.expression && ts.isJsxElement(node.parent)) {
      const text = literalText(node.expression);
      if (text !== null) out.push({ file, text, where: "jsx child" });
    }
    if (ts.isJsxAttribute(node) && SPOKEN_ATTRS.has(node.name.getText(source)) && node.initializer) {
      const init = node.initializer;
      const expr = ts.isJsxExpression(init) ? init.expression : init;
      const text = expr ? literalText(expr) : null;
      if (text !== null) out.push({ file, text, where: node.name.getText(source) });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

describe("the walk's words", () => {

  it("every literal a primitive shows or reads out is signed", () => {
    const words = FILES.flatMap((f) => spoken(f)).filter((f) => /[A-Za-z]/.test(f.text));
    // The scan reads real files and would see a typed word if one were there.
    expect(FILES.length).toBeGreaterThan(0);
    expect(spoken("probe.tsx", '<p aria-label="Unsigned">Hello</p>').map((f) => f.text)).toEqual(["Unsigned", "Hello"]);
    const unsigned = words.filter((f) => !SIGNED.has(f.text));
    expect(unsigned, unsigned.map((f) => `${f.file} (${f.where}): ${f.text}`).join("\n")).toEqual([]);
  });

  it("no signed walk line carries a digit", () => {
    expect(SIGNED.size).toBeGreaterThan(0);
    expect([...SIGNED].filter((s) => /\d/.test(s))).toEqual([]);
  });
});
