import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* -------------------------------------------------------------------------- */
/*  The coach's corpus routes go through callBackend by the one relay idiom.   */
/*  (The speaker's after-practice routes this relay also served — Bold voices, */
/*  the after-practice step, Lend your ear and the Album share switch — were  */
/*  retired by the backend, founder 2026-10-07, Q-B11 A, and their BFF routes */
/*  deleted, founder 2026-10-11.)                                             */
/* -------------------------------------------------------------------------- */

describe("the one relay", () => {
  it("every coach corpus route goes through it", () => {
    const routes = [
      "src/app/api/v2/coach/readings/route.ts",
      "src/app/api/v2/coach/readings/[readingId]/publish/route.ts",
      "src/app/api/v2/coach/licensed-clips/route.ts",
      "src/app/api/v2/coach/licensed-clips/[clipId]/label/route.ts",
    ];
    for (const route of routes) {
      const source = readFileSync(route, "utf8");
      expect(source).toMatch(/relay(Json|Form)\(/);
      expect(source).not.toMatch(/\bfetch\(/);
    }
    expect(readFileSync("src/app/api/_lib/afterPracticeRelay.ts", "utf8")).toContain("callBackend(");
  });
});
