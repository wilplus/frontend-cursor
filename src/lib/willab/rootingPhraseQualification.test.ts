import { describe, expect, it } from "vitest";
import {
  controlsForRootingPhraseState,
  RPQ_V1_UI_ENABLED,
} from "./rootingPhraseQualification";

describe("disabled Rooting Phrase Qualification V1 UI", () => {
  it("is structurally disabled", () => {
    expect(RPQ_V1_UI_ENABLED).toBe(false);
  });

  it("keeps lock and root separate in the direct path", () => {
    expect(controlsForRootingPhraseState("eligible_direct")).toEqual([
      "lock_and_make_rooting_phrase",
      "lock_only",
    ]);
  });

  it("routes rewritten text through practice before root activation", () => {
    expect(controlsForRootingPhraseState("pending_recording")).toEqual([
      "practice_this_phrase",
    ]);
    expect(controlsForRootingPhraseState("eligible_after_rerecord")).toEqual([
      "make_rooting_phrase",
      "not_now",
    ]);
  });

  it("never offers an action for a blocked machine result", () => {
    expect(controlsForRootingPhraseState("blocked_semantic_mismatch")).toEqual([]);
    expect(controlsForRootingPhraseState("blocked_semantic_unavailable")).toEqual([]);
  });
});
