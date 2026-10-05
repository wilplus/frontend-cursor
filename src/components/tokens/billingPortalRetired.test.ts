/* Subscriptions are retired (contract 50; founder 2026-10-05, N48.3 Q13 A):
 * every purchase is a one-time package, so there is nothing to manage and no
 * billing portal. The backend answers its old route with 410. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("the billing portal is gone (N48.3 Q13 A)", () => {
  it("removes the BFF route, the client and the plan controls", () => {
    for (const file of [
      "src/app/api/v2/tokens/portal/route.ts",
      "src/components/tokens/planControls.ts",
    ]) {
      expect(existsSync(join(process.cwd(), file)), file).toBe(false);
    }
    const subscribe = readFileSync(
      join(process.cwd(), "src/services/api/subscribe.ts"),
      "utf8",
    );
    expect(subscribe).not.toContain("/api/v2/tokens/portal");
  });
});
