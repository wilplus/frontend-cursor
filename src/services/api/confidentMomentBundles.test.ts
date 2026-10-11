import { describe, expect, it } from "vitest";
import { mapConfidentMomentSummary } from "./confidentMomentBundles";

const id = (last: string) => `00000000-0000-4000-8000-0000000000${last}`;
const hash = (digit: string) => digit.repeat(64);

const summary = {
  contract_version: "confident-moment-core-summary-v1",
  document_snapshot_id: id("01"),
  summary_sha256: hash("a"),
  items: [{
    bundle_id: id("02"), paragraph_id: id("03"), slide_index: 0,
    block_key: 0, marker_present: true, is_orange: true, is_locked: false,
    has_coach_update: true, has_unread_coach_update: true, state_revision: 1,
  }],
};

describe("confident moment summary", () => {
  it("strictly maps the stable first-paint summary", () => {
    expect(mapConfidentMomentSummary(summary)?.items[0]).toMatchObject({
      bundleId: id("02"), paragraphId: id("03"), hasUnreadCoachUpdate: true,
    });
    expect(mapConfidentMomentSummary({ ...summary, score: 0.9 })).toBeNull();
    expect(mapConfidentMomentSummary({
      ...summary,
      items: [{ ...summary.items[0], has_coach_update: false }],
    })).toBeNull();
  });
});
