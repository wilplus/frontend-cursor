/* The coach half of the MLC-3 exercise service loop is retired with the loop
 * (founder 2026-09-30, L8; contract 66). In the backend every path under the
 * coach MLC-3 prefix is one 410 tombstone (routes/v2/mlc3_first_client_coach.py)
 * and the corpus queue never hands out an MLC-3 inline blind assignment again
 * (routes/v2/coach.py, _inline_authoring_for). So no source here calls the
 * prefix — not the inline render or judgment, not the source playback the
 * corpus card pointed its clip at — and the BFF proxy for it is gone. The
 * coach's blind queue keeps the presentation lane and the MLC-2 chain. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/** Built, not written, so this fence is not itself a reference to it. */
const RETIRED_PREFIX = ["coach", "mlc3"].join("/");

const ROOTS = ["src", "e2e"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("the coach MLC-3 client is gone (L8; contract 66)", () => {
  it("no source or test calls the retired coach prefix", () => {
    const callers: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(join(process.cwd(), root))) {
        if (readFileSync(file, "utf8").includes(RETIRED_PREFIX)) {
          callers.push(relative(process.cwd(), file));
        }
      }
    }
    expect(callers).toEqual([]);
  });

  it("removes the BFF proxy", () => {
    const proxy = join("src", "app", "api", "v2", ...RETIRED_PREFIX.split("/"));
    expect(existsSync(join(process.cwd(), proxy)), proxy).toBe(false);
  });
});
