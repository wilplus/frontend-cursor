/**
 * The local gate's own verdict. localCiMirror.test.ts pins WHAT
 * scripts/local_ci.sh runs; this runs the real script, with stand-ins for
 * node, npm and npx first on PATH so every step returns at once, and pins
 * what it then reports.
 *
 * On macOS `bash` here is /bin/bash 3.2, the shell in which the script exited
 * 1 with no GREEN exactly when every step had passed (2026-10-06: under
 * `set -u` it calls an empty array unbound). CI's bash 5 never had that bug,
 * so only a run on a Mac can catch it coming back.
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

function gate({ node = "v22.23.2", fail = "" } = {}) {
  const calls = join(bin, "calls.log");
  writeFileSync(calls, "");
  const run = spawnSync("bash", ["scripts/local_ci.sh"], {
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
