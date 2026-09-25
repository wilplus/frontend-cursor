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

  it("sends exact policy and copy identifiers with the explicit action", () => {
    const api = read("services/api/mlc2Consent.ts");
    expect(api).toContain("accepted: true");
    expect(api).toContain("status.consent_policy_version");
    expect(api).toContain("status.approved_copy_sha256");
    expect(api).toContain("crypto.randomUUID()");
  });

  it("keeps ordinary users outside the founder gate contract", () => {
    const gate = read("components/willab/Mlc2FounderConsentGate.tsx");
    const surface = read("components/willab/WillabSurface.tsx");
    const dashboard = read("components/dashboard/DashboardHeader.tsx");
    expect(gate).toContain("!status.applicable || status.granted");
    expect(gate).toContain("if (!founderEligible)");
    expect(surface).toContain("MLC2_FOUNDER_CANARY_EMAIL");
    // The Data & consent LINK is no longer founder-only (founder 2026-09-25,
    // E4 = A): the page it opens now carries every person's own choices, not
    // the MLC-2 canary consent, so every signed-in person gets it. The founder
    // gate itself (above) is unchanged.
    for (const header of [dashboard, read("components/SiteHeader.tsx")]) {
      expect(header).toContain('dataConsentHref="/account/data-consent"');
      expect(header).not.toContain("MLC2_FOUNDER_CANARY_EMAIL");
    }
  });

  it("does not reuse the old local welcome transition as legal consent", () => {
    const gate = read("components/willab/Mlc2FounderConsentGate.tsx");
    const surface = read("components/willab/WillabSurface.tsx");
    expect(gate).not.toContain("onGranted");
    expect(surface).not.toContain("onGranted={flow.acceptConsent}");
  });

  it("ships explicit withdrawal rather than silently clearing history", () => {
    // The page now carries the person's own choices (founder 2026-09-25,
    // F2 = A). Both destructive changes still ask first: turning practice off
    // (which deletes the practice recordings) and withdrawing the consent
    // recording rests on each go through a confirm step with its approved
    // question.
    const body = read("components/account/DataConsentChoices.tsx");
    const copy = read("lib/legal/dataConsentCopy.ts");
    expect(body.match(/<Confirm\b/g)?.length).toBe(2);
    expect(body).toContain("question={COPY.turnOffConfirm}");
    expect(body).toContain("question={COPY.withdrawConfirm}");
    expect(copy).toContain("Your practice recordings will be deleted.");
    expect(copy).toContain("Withdraw and stop recording?");
    const api = read("services/api/mlc2Consent.ts");
    expect(api).toContain('method: "DELETE"');
  });

  it("uses the one BFF idiom for every backend consent call", () => {
    const route = read("app/api/v2/user/mlc2-consent/route.ts");
    expect(route).toContain('import { callBackend } from "@/app/api/_lib/backend"');
    expect(route.match(/callBackend\(/g)?.length).toBe(3);
    expect(route).not.toContain("fetch(");
  });
});

describe("legal copy version aligns with the canonical policy", () => {
  it("publishes Terms and Privacy version 1.2", () => {
    const privacy = read("app/privacy/page.tsx");
    const terms = read("app/terms/page.tsx");
    expect(privacy).toContain("Version 1.2");
    expect(terms).toContain("Version 1.2");
    expect(privacy).toContain("Article 6(1)(a)");
    expect(privacy).toContain("Article 9(2)(a)");
  });
});
