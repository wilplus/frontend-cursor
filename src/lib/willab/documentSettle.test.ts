/*
STORY    As a speaker, I want the "Working on your text" screen to come down
         only when my new Ideal Text has really arrived (or after a time
         limit), so that I never see last Take's text presented as the new
         one (Never 5: the Ideal Text is what I said in my latest Take).
OUTCOME
  O1  An older version and an older take index keep the screen up, even
      long after the readout went ready.
  O2  The new Take's version, or a piece from the new Take, releases it.
  O3  Past the cap with no evidence the block expires, never "settled".
PROVES   O1 -> "holds the block while the served text is still the previous Take's"
         O2 -> "releases on the new Take's version or a piece from the new Take"
         O3 -> "expires past the cap; a stuck block is worse than a stale read"
WHY      SPEC-lockin-loop §1; handoff §6.4 S3: clearing at readout_ready showed
         the PREVIOUS document as current.
*/
import { describe, expect, it } from "vitest";

import {
  DOCUMENT_SETTLE_CAP_MS,
  documentSettled,
} from "./documentSettle";

const T0 = 1_000_000;
// The speaker just recorded Take 3; the served document is still Take 2's.
const PREVIOUS = { version: 2, maxTakeIndex: 2 };

describe("documentSettled", () => {
  it("holds the block while the served text is still the previous Take's", () => {
    expect(documentSettled(3, PREVIOUS, PREVIOUS, T0, T0 + 1_000)).toBe("waiting");
    expect(
      documentSettled(3, PREVIOUS, PREVIOUS, T0, T0 + DOCUMENT_SETTLE_CAP_MS),
    ).toBe("waiting");
  });

  it("releases on the new Take's version or a piece from the new Take", () => {
    expect(
      documentSettled(3, PREVIOUS, { version: 3, maxTakeIndex: 2 }, T0, T0 + 1_000),
    ).toBe("settled");
    expect(
      documentSettled(3, null, { version: null, maxTakeIndex: 3 }, T0, T0 + 1_000),
    ).toBe("settled");
  });

  it("expires past the cap; a stuck block is worse than a stale read", () => {
    expect(
      documentSettled(
        3,
        PREVIOUS,
        PREVIOUS,
        T0,
        T0 + DOCUMENT_SETTLE_CAP_MS + 1
      )
    ).toBe("expired");
  });
});
