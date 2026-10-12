import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";


const SRC = join(fileURLToPath(new URL("../../", import.meta.url)));
const read = (relative: string) => readFileSync(join(SRC, relative), "utf8");

describe("MLC-2 founder consent UI contract", () => {
  it("requires an initially-unselected affirmative checkbox", () => {
    const gate = read("components/willab/Mlc2FounderConsentGate.tsx");
    expect(gate).toContain("useState(false)");
    expect(gate).toContain('type="checkbox"');
    expect(gate).toContain("disabled={!accepted || saving}");
    expect(gate).not.toContain("defaultChecked");
  });
});

describe("legal copy version aligns with the canonical policy", () => {
  it("shows only the stored Terms, never a stale stand-in", () => {
    // Founder 2026-09-25, decision 2 — the same fix F3 gave Privacy. The
    // v1.2 stand-in (the retired bundled consent) was all a visitor without
    // an owner ever read. The page now shows the stored copy, read on the
    // server, and says plainly when it cannot be read.
    const terms = read("app/terms/page.tsx");
    expect(terms).toContain('<PublishedPolicyText\n        which="terms"');
    expect(terms).toContain("initial={initial}");
    expect(terms).toContain("<SectionLoadingState />");
    expect(terms).toContain("DATA_CONSENT_COPY.termsUnavailable");
    for (const stale of ["Version 1.2", "28 August 2026. Version", "pooled"]) {
      expect(terms).not.toContain(stale);
    }
  });
});
