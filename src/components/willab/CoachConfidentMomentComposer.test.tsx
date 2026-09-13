import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("CoachConfidentMomentComposer boundary", () => {
  it("requires all three literal presentation gates and revealed DB context", () => {
    const api = read("src/services/api/coachGuidanceDelivery.ts");
    const composer = read(
      "src/components/willab/CoachConfidentMomentComposer.tsx",
    );
    expect(api).toContain("NEXT_PUBLIC_MLC3_SERVICE_UI_ENABLED");
    expect(api).toContain("NEXT_PUBLIC_MLC3_COACH_INLINE_AUTHORING_ENABLED");
    expect(api).toContain("NEXT_PUBLIC_CONFIDENT_MOMENT_BUNDLE_V1_ENABLED");
    expect(api).toContain("COACH_GUIDANCE_D3_UI_ENABLED &&");
    expect(api).toContain("COACH_INLINE_AUTHORING_UI_ENABLED &&");
    expect(api).toContain("CONFIDENT_MOMENT_BUNDLE_UI_ENABLED");
    expect(composer).toContain("!revealed || !context");
    expect(composer).toContain("context.authorizedTargets.length === 0");
  });

  it("opens a full overlay without changing the blind review boundary", () => {
    const composer = read(
      "src/components/willab/CoachConfidentMomentComposer.tsx",
    );
    const host = read(
      "src/components/willab/CoachStarVerdictOverlay.tsx",
    );
    const blind = read(
      "src/components/willab/CoachInlineBlindExposureBoundary.tsx",
    );
    expect(composer).toContain('role="dialog"');
    expect(composer).toContain('aria-modal="true"');
    expect(composer).toContain("useBackDismiss(onClose)");
    expect(host).toContain("<CoachConfidentMomentComposer");
    expect(host).toContain("revealed={guidanceBatch?.batchComplete === true}");
    expect(blind).not.toContain("CoachConfidentMomentComposer");
  });

  it("keeps the existing exercise composer directly in the revealed flow", () => {
    const host = read(
      "src/components/willab/CoachStarVerdictOverlay.tsx",
    );
    expect(host).toMatch(
      /<CoachConfidentMomentComposer[\s\S]*?<CoachGuidanceComposer/,
    );
  });

  it("uses the BFF as a transparent adapter to the exact backend route", () => {
    const route = read(
      "src/app/api/v2/coach/confident-moment-bundles/[bundleId]/attachments/[attachmentId]/feedback-language/route.ts",
    );
    expect(route).toContain("callBackend(");
    expect(route).toContain("`/v2/coach/confident-moment-bundles/${encodeURIComponent(");
    expect(route).toContain(")}/attachments/${encodeURIComponent(attachmentId)}/feedback-language`");
    expect(route).not.toContain("getBackendUrl");
    expect(route).not.toContain("fetch(");
  });
});
