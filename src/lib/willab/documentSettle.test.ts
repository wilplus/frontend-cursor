import { describe, expect, it } from "vitest";

import {
  DOCUMENT_SETTLE_CAP_MS,
  documentSettled,
} from "./documentSettle";

/* -------------------------------------------------------------------------- */
/*  SPEC-lockin-loop §1 — the blocking screen drops ONLY on evidence the new    */
/*  text landed, or on the bounded cap. Handoff §6.4 S3 is the failure this    */
/*  pins: clearing at readout_ready rendered the PREVIOUS document as          */
/*  current, exactly when the founder's flow promises the new one.             */
/* -------------------------------------------------------------------------- */

const T0 = 1_000_000;

describe("documentSettled", () => {

  it("expires past the cap — a stuck block is worse than a stale read", () => {
    expect(
      documentSettled(
        3,
        null,
        { version: null, maxTakeIndex: null },
        T0,
        T0 + DOCUMENT_SETTLE_CAP_MS + 1
      )
    ).toBe("expired");
  });
});
