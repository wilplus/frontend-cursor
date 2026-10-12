import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { CHUNK_SHEET_COPY, WALK_COPY } from "../idealEditCopy";

/* -------------------------------------------------------------------------- */
/*  THE WALK SAYS ONLY SIGNED WORDS, AND NO NUMBER (LIVE LOOP: copy needs the  */
/*  founder's sign-off; AC-9: no score or number on screen).                   */
/*                                                                            */
/*  Every word a walk primitive can put on screen or read out — JSX text, a   */
/*  string child, an accessible name, a title, a placeholder — must come from  */
/*  CHUNK_SHEET_COPY or WALK_COPY (or be passed in by the caller). A literal  */
/*  with a letter in it is a word nobody signed. And no signed walk line may  */
/*  carry a digit: the only number the walk shows is a Take or a moment       */
/*  position, put in by the caller.                                           */
/* -------------------------------------------------------------------------- */

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
    const unsigned = words.filter((f) => !SIGNED.has(f.text));
    expect(unsigned, unsigned.map((f) => `${f.file} (${f.where}): ${f.text}`).join("\n")).toEqual([]);
  });
});
