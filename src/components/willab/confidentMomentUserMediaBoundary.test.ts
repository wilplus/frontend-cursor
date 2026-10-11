import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const code = (path: string) => readFileSync(path, "utf8");

describe("Confident Moment user media boundary", () => {
  it("keeps source playback authenticated, abortable, same-origin, and no-store", () => {
    const route = code("src/app/api/v2/user/confident-moment-bundles/[bundleId]/attachments/[attachmentId]/source-playback/route.ts");
    expect(route).toContain("getAccessToken");
    expect(route).toContain("signal: request.signal");
    expect(route).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(route).not.toContain("presign");
  });
});
