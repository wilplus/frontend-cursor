/*
GUARD    The local gate's verdict: the real scripts/local_ci.sh, run with
         stand-ins for node, npm and npx first on PATH so every step returns
         at once.
CATCHES  GREEN printed when a step failed or the build was skipped; a failed
         step not named; a run on a Node older than CI's; the macOS bash 3.2
         "unbound variable" exit (2026-10-06) when every step passed.
IF REMOVED  The gate's GREEN could stop meaning "every step passed".
PROVES   green  -> "is GREEN and exits 0 when every step passes"
         red    -> "is RED and exits 1 when a step fails, printing that step's own log"
         no build -> "is INCOMPLETE, never GREEN, when the build is skipped"
         node   -> "stops before its first step, naming the Node it found"
*/
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let bin: string;

beforeAll(() => {
  bin = mkdtempSync(join(tmpdir(), "local-ci-"));
  const stub = (name: string, body: string) =>
    writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  stub("node", 'echo "$FAKE_NODE"');
  // `npm run <script>`: record the call, and fail only the script named in $FAIL.
  stub("npm", 'echo "$*" >> "$CALLS"; echo "ran npm $*"; [ "$2" != "$FAIL" ]');
  stub("npx", 'echo "$*" >> "$CALLS"');
});
afterAll(() => rmSync(bin, { recursive: true, force: true }));

function gate({ node = "v22.23.2", fail = "", args = [] as string[] } = {}) {
  const calls = join(bin, "calls.log");
  writeFileSync(calls, "");
  const run = spawnSync("bash", ["scripts/local_ci.sh", ...args], {
    encoding: "utf8",
    // The stand-ins and the system's own tools only: no real node or npm is
    // reachable, and no WILLAB_SCREENSHOTS leaks in from the caller.
    env: { PATH: `${bin}:/usr/bin:/bin`, TMPDIR: tmpdir(), FAKE_NODE: node, FAIL: fail, CALLS: calls },
  });
  return {
    code: run.status,
    out: run.stdout + run.stderr,
    steps: readFileSync(calls, "utf8").split("\n").filter(Boolean),
  };
}

describe("the gate reports what its steps did", () => {
  it("is GREEN and exits 0 when every step passes", () => {
    const { code, out, steps } = gate();
    expect(out).not.toContain("unbound variable");
    expect(out).toContain("GREEN — every gate CI runs, plus the build Vercel runs.");
    expect(steps).toContain("run build");
    expect(code).toBe(0);
  });

  it("is RED and exits 1 when a step fails, printing that step's own log", () => {
    const { code, out } = gate({ fail: "lint" });
    expect(out).toContain("FAIL Lint");
    expect(out).toContain("ran npm run lint");
    expect(out).toContain("RED — 1 step(s) failed. Not mergeable.");
    expect(code).toBe(1);
  });

  it("is INCOMPLETE, never GREEN, when the build is skipped", () => {
    // --no-build exists for iterating, and must never look like a passing gate.
    const { code, out, steps } = gate({ args: ["--no-build"] });
    expect(out).toContain("INCOMPLETE — the production build was skipped.");
    expect(out).not.toContain("GREEN");
    expect(steps).not.toContain("run build");
    expect(code).toBe(1);
  });
});

describe("the gate refuses a Node older than CI's", () => {
  it("stops before its first step, naming the Node it found", () => {
    const { code, out, steps } = gate({ node: "v20.19.3" });
    expect(out).toContain("STOPPED — the gate needs Node 22 or newer");
    expect(out).toContain("v20.19.3");
    expect(steps).toEqual([]);
    expect(code).toBe(2);
  });
});
