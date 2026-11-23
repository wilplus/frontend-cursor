import type { Prompt, PromptFile } from "./types";

/* A small reader for prompts_v1.yaml. It understands that file and nothing
   wider: plain lines, flow lists, flow maps, and double-quoted text.
   The founder edits the yaml. This checks the shape and refuses a file
   that has drifted. */

export class PromptFileError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join(" "));
    this.name = "PromptFileError";
    this.errors = errors;
  }
}

type Yaml = string | number | boolean | null | Yaml[] | { [key: string]: Yaml };

export function loadPromptFile(text: string): PromptFile {
  let raw: Yaml;
  try {
    raw = parseDocument(text);
  } catch (err) {
    throw new PromptFileError([err instanceof Error ? err.message : "The prompt file could not be read."]);
  }
  const errors = checkPromptFile(raw);
  if (errors.length) throw new PromptFileError(errors);
  return shape(raw as Record<string, Yaml>);
}

/** The same checks, for a file already parsed. */
export function checkPromptFile(raw: unknown): string[] {
  const errors: string[] = [];
  if (!isMap(raw)) return ["The prompt file must be a map of fields."];
  const keys = Object.keys(raw);
  const expected = ["version", "language", "order", "baseline_scored", "reference_scored", "prompts", "self_report"];
  for (const key of expected) {
    if (!(key in raw)) errors.push(`Missing ${key}.`);
  }
  for (const key of keys) {
    if (!expected.includes(key)) errors.push(`Unexpected field ${key}.`);
  }
  if (raw.version !== 1) errors.push("version must be 1.");
  if (typeof raw.language !== "string" || !raw.language.trim()) errors.push("language must be a word.");
  const order = stringList(raw.order, "order", errors);
  const baseline = stringList(raw.baseline_scored, "baseline_scored", errors);
  const reference = stringList(raw.reference_scored, "reference_scored", errors);
  if (order && baseline && reference) checkScoring(order, baseline, reference, errors);
  checkPrompts(raw.prompts, errors);
  checkSelfReport(raw.self_report, errors);
  return errors;
}

function shape(raw: Record<string, Yaml>): PromptFile {
  const prompts = (raw.prompts as Record<string, Yaml>[]).map((row) => {
    const prompt: Prompt = {
      id: String(row.id),
      tag: String(row.tag),
      text: String(row.text),
    };
    if (typeof row.reference === "string") prompt.reference = row.reference;
    return prompt;
  });
  const report = raw.self_report as Record<string, Yaml>;
  return {
    version: 1,
    language: String(raw.language),
    order: raw.order as string[],
    baseline_scored: raw.baseline_scored as string[],
    reference_scored: raw.reference_scored as string[],
    prompts,
    self_report: {
      energy: report.energy as [string, string],
      feeling: report.feeling as [string, string],
    },
  };
}

function checkScoring(order: string[], baseline: string[], reference: string[], errors: string[]) {
  const overlap = baseline.filter((key) => reference.includes(key));
  if (overlap.length) errors.push(`A step cannot be in both lists: ${overlap.join(", ")}.`);
  const listed = new Set([...baseline, ...reference]);
  const known = new Set<string>();
  for (const axis of order) {
    known.add(axis);
    known.add(`${axis}_voice`);
    known.add(`${axis}_words`);
    const voice = `${axis}_voice`;
    const words = `${axis}_words`;
    const split = listed.has(voice) || listed.has(words);
    if (split) {
      if (!listed.has(voice) || !listed.has(words)) errors.push(`${axis} needs both ${voice} and ${words}.`);
      if (listed.has(axis)) errors.push(`${axis} is listed twice, once on its own and once in parts.`);
    } else if (!listed.has(axis)) {
      errors.push(`${axis} must be in baseline_scored or reference_scored.`);
    }
  }
  for (const key of listed) {
    if (!known.has(key)) errors.push(`${key} is not a step in order.`);
  }
}

function checkPrompts(raw: unknown, errors: string[]) {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push("prompts must be a list.");
    return;
  }
  const ids = new Set<string>();
  raw.forEach((row, index) => {
    const where = `prompts[${index}]`;
    if (!isMap(row)) {
      errors.push(`${where} must be a map.`);
      return;
    }
    for (const key of Object.keys(row)) {
      if (key !== "id" && key !== "tag" && key !== "text" && key !== "reference") errors.push(`${where} has unexpected ${key}.`);
    }
    if (typeof row.id !== "string" || !row.id.trim()) errors.push(`${where}.id is missing.`);
    else if (ids.has(row.id)) errors.push(`${where}.id repeats ${row.id}.`);
    else ids.add(row.id);
    if (typeof row.tag !== "string" || !row.tag.trim()) errors.push(`${where}.tag is missing.`);
    if (typeof row.text !== "string" || !row.text.trim()) errors.push(`${where}.text is missing.`);
    if ("reference" in row && (typeof row.reference !== "string" || !row.reference.trim())) errors.push(`${where}.reference must be a word.`);
  });
}

function checkSelfReport(raw: unknown, errors: string[]) {
  if (!isMap(raw)) {
    errors.push("self_report must be a map.");
    return;
  }
  for (const key of Object.keys(raw)) {
    if (key !== "energy" && key !== "feeling") errors.push(`self_report has unexpected ${key}.`);
  }
  pair(raw.energy, "self_report.energy", errors);
  pair(raw.feeling, "self_report.feeling", errors);
}

function pair(raw: unknown, name: string, errors: string[]) {
  if (!Array.isArray(raw) || raw.length !== 2 || raw.some((item) => typeof item !== "string" || !item.trim())) {
    errors.push(`${name} must be two words.`);
    return;
  }
  if (raw[0] === raw[1]) errors.push(`${name} must be two different words.`);
}

function stringList(raw: unknown, name: string, errors: string[]): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.some((item) => typeof item !== "string" || !item.trim())) {
    errors.push(`${name} must be a list of words.`);
    return null;
  }
  if (new Set(raw).size !== raw.length) errors.push(`${name} repeats a word.`);
  return raw as string[];
}

function isMap(raw: unknown): raw is Record<string, Yaml> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

function parseDocument(text: string): Yaml {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let i = 0;

  function skip() {
    while (i < lines.length && /^\s*(#.*)?$/.test(lines[i])) i += 1;
  }

  function indent(line: string): number {
    return /^ */.exec(line)?.[0].length ?? 0;
  }

  function block(min: number): Yaml {
    skip();
    if (i >= lines.length || indent(lines[i]) < min) return {};
    const pad = indent(lines[i]);
    if (lines[i].trimStart().startsWith("- ")) return sequence(pad);
    const map: Record<string, Yaml> = {};
    while (i < lines.length) {
      skip();
      if (i >= lines.length || indent(lines[i]) < pad) break;
      if (indent(lines[i]) !== pad) throw new Error(`Line ${i + 1} is indented too far.`);
      const trimmed = lines[i].trim();
      const cut = trimmed.indexOf(":");
      if (cut <= 0) throw new Error(`Line ${i + 1} needs a field name.`);
      const key = trimmed.slice(0, cut).trim();
      const rest = trimmed.slice(cut + 1).trim();
      if (key in map) throw new Error(`Line ${i + 1} repeats ${key}.`);
      i += 1;
      map[key] = rest === "" ? block(pad + 1) : parseValue(rest, i);
    }
    return map;
  }

  function sequence(pad: number): Yaml[] {
    const items: Yaml[] = [];
    while (i < lines.length) {
      skip();
      if (i >= lines.length || indent(lines[i]) !== pad || !lines[i].trimStart().startsWith("- ")) break;
      const rest = lines[i].trimStart().slice(2).trim();
      const line = i + 1;
      i += 1;
      if (!rest) throw new Error(`Line ${line} has an empty list item.`);
      items.push(parseValue(rest, line));
    }
    return items;
  }

  return block(0);
}

function parseValue(src: string, line: number): Yaml {
  const found = readValue(src, 0, line);
  const rest = src.slice(found.i).trim();
  if (rest) throw new Error(`Line ${line} has extra text.`);
  return found.v;
}

function readValue(src: string, at: number, line: number): { v: Yaml; i: number } {
  let i = at;
  while (src[i] === " ") i += 1;
  const ch = src[i];
  if (ch === '"') return readQuoted(src, i, line);
  if (ch === "[") return readFlow(src, i, line, "]", (body) => splitFlow(body, line));
  if (ch === "{") return readFlow(src, i, line, "}", (body) => readMap(body, line));
  let j = i;
  while (j < src.length && src[j] !== "," && src[j] !== "}" && src[j] !== "]") j += 1;
  return { v: coerce(src.slice(i, j).trim(), line), i: j };
}

function readQuoted(src: string, at: number, line: number): { v: string; i: number } {
  let i = at + 1;
  let out = "";
  while (i < src.length && src[i] !== '"') {
    if (src[i] === "\\" && i + 1 < src.length) {
      out += src[i + 1];
      i += 2;
      continue;
    }
    out += src[i];
    i += 1;
  }
  if (src[i] !== '"') throw new Error(`Line ${line} has an unclosed quote.`);
  return { v: out, i: i + 1 };
}

function readFlow(src: string, at: number, line: number, end: string, build: (body: string) => Yaml): { v: Yaml; i: number } {
  let i = at + 1;
  let depth = 1;
  let quote = false;
  const start = i;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") i += 2;
      else {
        if (ch === '"') quote = false;
        i += 1;
      }
      continue;
    }
    if (ch === '"') quote = true;
    else if (ch === "[" || ch === "{") depth += 1;
    else if (ch === "]" || ch === "}") depth -= 1;
    if (depth > 0) i += 1;
  }
  if (depth !== 0 || src[i] !== end) throw new Error(`Line ${line} has an unclosed list or map.`);
  return { v: build(src.slice(start, i)), i: i + 1 };
}

function splitFlow(body: string, line: number): Yaml[] {
  const items: Yaml[] = [];
  let i = 0;
  while (i < body.length) {
    while (body[i] === " " || body[i] === ",") i += 1;
    if (i >= body.length) break;
    const found = readValue(body, i, line);
    items.push(found.v);
    i = found.i;
  }
  return items;
}

function readMap(body: string, line: number): Record<string, Yaml> {
  const map: Record<string, Yaml> = {};
  let i = 0;
  while (i < body.length) {
    while (body[i] === " " || body[i] === ",") i += 1;
    if (i >= body.length) break;
    const cut = body.indexOf(":", i);
    if (cut < 0) throw new Error(`Line ${line} has a map entry with no name.`);
    const key = body.slice(i, cut).trim();
    if (!key) throw new Error(`Line ${line} has an empty field name.`);
    const found = readValue(body, cut + 1, line);
    map[key] = found.v;
    i = found.i;
  }
  return map;
}

function coerce(raw: string, line: number): Yaml {
  if (!raw) throw new Error(`Line ${line} has an empty value.`);
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null" || raw === "~") return null;
  return raw;
}
