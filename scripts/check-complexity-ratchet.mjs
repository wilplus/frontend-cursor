#!/usr/bin/env node
/**
 * The cyclomatic-complexity ratchet (audit Q-C7, founder decision 2026-09-14,
 * option a).
 *
 * Nothing flagged a new CC-121 function before this (`.eslintrc.json` is
 * `next/core-web-vitals` only). Now every function under src/ must have a
 * cyclomatic complexity of at most THRESHOLD — or be listed, at its frozen
 * value, in scripts/complexity-baseline.json. Same pattern as the BFF
 * single-idiom ratchet: the baseline is the grandfathered set and it only
 * ever shrinks, in a reviewed commit.
 *
 *   node scripts/check-complexity-ratchet.mjs            # check
 *   node scripts/check-complexity-ratchet.mjs --update   # re-freeze
 *
 * Measured with ESLint's own `complexity` rule (the repo's ESLint, the repo's
 * parser config), run at threshold 1 so every function reports its value.
 * Keys are `file:Function 'name'`; an anonymous function is keyed by its
 * kind and its ordinal in the file (`file:Arrow function#3`), so a value
 * survives the lines around it moving. Two named functions sharing a key
 * (overloads, same-named handlers in one file) share the larger value.
 *
 * The check fails when
 *   - a function over the threshold is not in the baseline (new offender),
 *   - a listed function grew past its frozen value (it may only come down),
 *   - a listed function is now within the threshold or no longer exists
 *     (re-freeze so the shrink is visible).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { relative } from "node:path";
import { ESLint } from "eslint";

export const THRESHOLD = 25;
export const BASELINE_PATH = "scripts/complexity-baseline.json";
const TARGETS = ["src/**/*.{ts,tsx}"];
const MESSAGE = /^(.*?) has a complexity of (\d+)\./;

/** {key: complexity} for every function ESLint reports in `results`. */
export function measuresFrom(results, root = process.cwd()) {
  const out = new Map();
  for (const file of results) {
    const path = relative(root, file.filePath);
    const ordinals = new Map();
    for (const message of file.messages) {
      if (message.ruleId !== "complexity") continue;
      const match = MESSAGE.exec(message.message);
      if (!match) throw new Error(`unrecognised complexity message: ${message.message}`);
      let name = match[1];
      if (!name.includes("'")) {
        const n = (ordinals.get(name) ?? 0) + 1;
        ordinals.set(name, n);
        name = `${name}#${n}`;
      }
      const key = `${path}:${name}`;
      const cc = Number(match[2]);
      out.set(key, Math.max(out.get(key) ?? 0, cc));
    }
  }
  return out;
}

/** The ratchet's findings; empty when it holds. */
export function check(measures, baseline) {
  const problems = [];
  for (const key of [...measures.keys()].sort()) {
    const cc = measures.get(key);
    const frozen = baseline[key];
    if (frozen === undefined) {
      if (cc > THRESHOLD) problems.push(`${key}: CC ${cc} > ${THRESHOLD} and not grandfathered. Split it.`);
      continue;
    }
    if (cc <= THRESHOLD) {
      problems.push(`${key}: CC ${cc} is within the threshold now — remove it from the baseline (node scripts/check-complexity-ratchet.mjs --update)`);
    } else if (cc > frozen) {
      problems.push(`${key}: CC grew ${frozen} → ${cc}. A grandfathered function may only come down.`);
    }
  }
  for (const key of Object.keys(baseline)) {
    if (!measures.has(key)) problems.push(`${key}: in the baseline but no longer exists — re-freeze (node scripts/check-complexity-ratchet.mjs --update)`);
  }
  return problems;
}

export function frozenFrom(measures) {
  const frozen = {};
  for (const key of [...measures.keys()].sort()) {
    if (measures.get(key) > THRESHOLD) frozen[key] = measures.get(key);
  }
  return frozen;
}

async function measure() {
  const eslint = new ESLint({
    useEslintrc: true,
    allowInlineConfig: false,
    overrideConfig: { rules: { complexity: ["error", 1] } },
  });
  return measuresFrom(await eslint.lintFiles(TARGETS));
}

async function main(argv) {
  const measures = await measure();
  if (argv.includes("--update")) {
    const frozen = frozenFrom(measures);
    writeFileSync(BASELINE_PATH, JSON.stringify(frozen, null, 2) + "\n");
    console.log(`complexity ratchet: froze ${Object.keys(frozen).length} functions over CC ${THRESHOLD} into ${BASELINE_PATH}`);
    return 0;
  }
  const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : {};
  const problems = check(measures, baseline);
  const over = [...measures.values()].filter((cc) => cc > THRESHOLD).length;
  console.log(`complexity ratchet: ${measures.size} functions, ${over} grandfathered over CC ${THRESHOLD}`);
  for (const line of problems) console.log(`  FAIL ${line}`);
  return problems.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (error) => {
    console.error(error);
    process.exit(2);
  });
}
