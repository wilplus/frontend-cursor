import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("CoachFeedbackLanguageEditor contract", () => {
  it("submits only the database-authorized target and immutable heads", () => {
    const editor = read(
      "src/components/willab/CoachFeedbackLanguageEditor.tsx",
    );
    const api = read("src/services/api/coachGuidanceDelivery.ts");
    expect(editor).toContain("publishCoachFeedbackLanguage");
    expect(editor).toContain("expectedCurrentRevisionId: heads.revision");
    expect(editor).toContain("expectedCurrentDeliveryId: heads.delivery");
    expect(api).toContain("review_batch_id: input.item.reviewBatchId");
    expect(api).toContain("reveal_access_id: target.revealAccessId");
    expect(api).not.toContain("blind_judgment_id");
    expect(api).not.toContain("reviewer_principal_id");
    expect(api).not.toContain("recipient_principal_id");
  });

  it("keeps Comment and Rephrase as one typed Feedback Language surface", () => {
    const editor = read(
      "src/components/willab/CoachFeedbackLanguageEditor.tsx",
    );
    expect(editor).toContain('target.allowedOutputKind === "rephrase"');
    expect(editor).toContain('? "Rephrase" : "Comment"');
    expect(editor).not.toMatch(/score|confidence_score|qualification_state/);
  });
});
