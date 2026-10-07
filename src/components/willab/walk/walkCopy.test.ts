import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { CHUNK_SHEET_COPY, WALK_COPY, WALK_LINE_BANK } from "../idealEditCopy";

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

describe("the scanner", () => {
  it("finds text, string children, spoken attributes and templates; ignores classes", () => {
    const found = spoken("x.tsx", `const a = () => (
      <div className="flex gap-2" data-x="never">
        Hello there
        {"A child"}
        <b aria-label="Read out" title={\`Tip \${n}\`}>{COPY.pagerNext}</b>
      </div>);`).map((f) => f.text);
    expect(found).toEqual(["Hello there", "A child", "Read out", "Tip  "]);
  });
});

describe("the walk's words", () => {
  it("scans every primitive", () => {
    expect(FILES).toEqual(
      expect.arrayContaining([
        "WalkOverlay.tsx",
        "WalkStage.tsx",
        "WalkMessage.tsx",
        "WalkPlayer.tsx",
        "WalkJudgement.tsx",
        "WalkFooter.tsx",
        "WalkOptions.tsx",
        "WalkToast.tsx",
        "WalkLoading.tsx",
        "RecordingStrip.tsx",
        "FeedbackWalk.tsx",
      ]),
    );
  });

  it("every literal a primitive shows or reads out is signed", () => {
    const words = FILES.flatMap((f) => spoken(f)).filter((f) => /[A-Za-z]/.test(f.text));
    const unsigned = words.filter((f) => !SIGNED.has(f.text));
    expect(unsigned, unsigned.map((f) => `${f.file} (${f.where}): ${f.text}`).join("\n")).toEqual([]);
  });

  it("no literal a primitive shows carries a digit (AC-9)", () => {
    const digits = FILES.flatMap((f) => spoken(f)).filter((f) => /\d/.test(f.text));
    expect(digits, digits.map((f) => `${f.file}: ${f.text}`).join("\n")).toEqual([]);
  });

  it("the primitives take their words from the copy file", () => {
    for (const file of FILES) {
      const src = readFileSync(join(DIR, file), "utf8");
      // Words in a primitive arrive by prop or from idealEditCopy / the shared
      // answer vocabulary; nothing else may supply a sentence. The walk's
      // controller (FeedbackWalk, D-FW-14) also draws the coach's video (the
      // one the locked screens already show), asks the page's guest gate
      // (useGuestBlock: no words of its own here) and reads a span type.
      const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
      for (const path of imports) {
        expect(path, `${file} imports ${path}`).toMatch(
          /^(react|lucide-react|@\/lib\/|@\/services\/api\/(stateRatings|partLock)$|\.\.\/(idealEditCopy|ConfidenceLabelChips|OverlayCloseButton|SnippetWavePlayer|LoadingState|willabHelpers|CoachVideo|GuestSignUpDialog)$|\.\/)/,
        );
      }
    }
  });
});

describe("WALK_COPY", () => {
  const lines = strings(WALK_COPY);

  it("has no digit in any signed line (AC-9)", () => {
    for (const line of lines) expect(line, line).not.toMatch(/\d/);
  });

  it("holds the eleven lines of N52.5, word for word", () => {
    expect(lines).toEqual(
      expect.arrayContaining([
        "It was better, and I have yet another practice for you to try!",
        "Judgement time!",
        "If you are honest when judging others, it will help you find your confident voice and calm the inner critic 😌",
        "More about self-modeling theory",
        "I am going to judge them honestly",
        "Skip",
        "Here is a slightly more polished option:",
        "Do you accept and want to practise it?",
        "Practise",
        "After all, it's about speaking publicly!",
        "Do you agree to share this take with others?",
      ]),
    );
  });

  it("the answer toast is the answer's own word with a tick (WQ4 A)", () => {
    expect(WALK_COPY.answerToast("Audio unclear")).toBe("Audio unclear ✓");
  });

  it("never says a score, a percentage or a ranking", () => {
    for (const line of lines) expect(line, line).not.toMatch(/%|\bscore\b|\brank/i);
  });
});

describe("WALK_LINE_BANK", () => {
  it("has B01 to B14 and no number but the Take's", () => {
    expect(Object.keys(WALK_LINE_BANK)).toEqual(
      ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B09", "B10", "B11", "B12", "B13", "B14"],
    );
    for (const bank of Object.values(WALK_LINE_BANK)) {
      for (const line of bank.lines) expect(line, line).not.toMatch(/\d/);
      if ("later" in bank) {
        const later = bank.later(7);
        expect(later.replace("Take 7", ""), later).not.toMatch(/\d/);
      }
    }
  });

  it("opens and asks with the clearer version's signed first lines", () => {
    expect(WALK_LINE_BANK.B13.lines[0]).toBe(WALK_COPY.clearerOffer);
    expect(WALK_LINE_BANK.B14.lines[0]).toBe(WALK_COPY.clearerAsk);
  });
});
