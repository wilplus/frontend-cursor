/*
GUARD    scripts/check-app-model.mjs: a change that removes frontend code or a
         frontend test an App Model story names fails (backend N574 item 4).
CATCHES  A rename, a deleted line or a deleted test that leaves a story of the
         App Model pointing at nothing.
IF REMOVED  The App Model's stories (kept in the backend) go stale silently,
         and the developer comparing the code with the model follows dead refs.
PROVES   broken  -> "fails a change that removes the code or the test a story names"
         stale   -> "lists what main already misses, without failing"
         backend -> "leaves the backend's refs and tests to the backend"
WHY      Founder, 9 November 2026: the App Model is the developer's reference,
         and a check keeps its stories true (backend N574).
*/
import { describe, expect, it } from "vitest";
import { check, modelFolder } from "./check-app-model.mjs";

const CSV = "file,type,story,outcomes,proves,why\nsrc/a.test.ts,story,x,,,\n";
const MAIN: Record<string, string> = {
  "src/A.tsx": "export function A() {\n  return 'Read it';\n}\n",
  "src/a.test.ts": "it('reads')",
  "docs/TEST-STORIES.csv": CSV,
};
const tree = (files: Record<string, string>) => (path: string) => files[path] ?? null;
const story = (code: string[], tests: string[] = []) => [{ id: "S-1", code, tests }];

describe("the App Model check (frontend half)", () => {
  it("fails a change that removes the code or the test a story names", () => {
    const here = { ...MAIN, "src/A.tsx": "export function A() {\n  return 'Show it';\n}\n" };
    delete (here as Record<string, string>)["src/a.test.ts"];
    const r = check(story(["fe:src/A.tsx::'Read it'", "fe:src/A.tsx"], ["src/a.test.ts"]), { head: tree(here), base: tree(MAIN) });
    expect(r.broken).toEqual([
      "S-1 names fe:src/A.tsx::'Read it', which this change removes.",
      "S-1 names the test src/a.test.ts, which this change deletes or takes out of docs/TEST-STORIES.csv.",
    ]);
    expect(check(story(["fe:src/A.tsx::'Read it'"], ["src/a.test.ts"]), { head: tree(MAIN), base: tree(MAIN) }).broken).toEqual([]);
  });

  it("lists what main already misses, without failing", () => {
    const r = check(story(["fe:src/Gone.tsx::x"], ["src/gone.test.ts"]), { head: tree(MAIN), base: tree(MAIN) });
    expect(r.broken).toEqual([]);
    expect(r.stale).toHaveLength(2);
  });

  it("leaves the backend's refs and tests to the backend", () => {
    const r = check(story(["be:services/plan.py::LEVELS"], ["tests/test_plan.py", "evals/golden.jsonl"]), {
      head: tree(MAIN),
      base: () => {
        throw new Error("the base is never read when nothing here fails");
      },
    });
    expect(r).toEqual({ broken: [], stale: [], refs: 0, tests: 0 });
    expect(modelFolder("[a](design/app-model-2026-11-09/) [b](design/app-model-2026-12-01/)")).toBe("app-model-2026-12-01");
  });
});
