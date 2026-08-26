import { describe, expect, it } from "vitest";

import {
  DOCUMENT_SETTLE_CAP_MS,
  documentSettled,
  probeOf,
} from "./documentSettle";

/* -------------------------------------------------------------------------- */
/*  SPEC-lockin-loop §1 — the blocking screen drops ONLY on evidence the new    */
/*  text landed, or on the bounded cap. Handoff §6.4 S3 is the failure this    */
/*  pins: clearing at readout_ready rendered the PREVIOUS document as          */
/*  current, exactly when the founder's flow promises the new one.             */
/* -------------------------------------------------------------------------- */

const T0 = 1_000_000;

describe("documentSettled", () => {
  it("settles on the first probe when the durable review version reached the Take", () => {
    // Synchronous processing may finish before this screen mounts, so there
    // is no earlier browser probe from which to observe a version delta.
    expect(
      documentSettled(
        2,
        null,
        { version: 2, maxTakeIndex: 1 },
        T0,
        T0 + 500
      )
    ).toBe("settled");
  });

  it("settles when the served pieces contain the awaited take", () => {
    expect(
      documentSettled(
        3,
        null,
        { version: 3, maxTakeIndex: 3 },
        T0,
        T0 + 4_000
      )
    ).toBe("settled");
    // A later take than awaited is also proof — the document moved past us.
    expect(
      documentSettled(
        3,
        null,
        { version: 4, maxTakeIndex: 4 },
        T0,
        T0 + 4_000
      )
    ).toBe("settled");
  });

  it("settles when the version moves under the probe — the won-no-block case", () => {
    // A take that wins no block never appears in pieces, but its reassembly
    // still bumps the version. The FIRST probe is the baseline.
    const first = { version: 2, maxTakeIndex: 1 };
    expect(
      documentSettled(
        null,
        first,
        { version: 3, maxTakeIndex: 1 },
        T0,
        T0 + 8_000
      )
    ).toBe("settled");
  });

  it("waits while there is no evidence either way", () => {
    const first = { version: 2, maxTakeIndex: 1 };
    expect(
      documentSettled(3, first, first, T0, T0 + 8_000)
    ).toBe("waiting");
    // Null fields are ABSENCE of evidence, never evidence.
    expect(
      documentSettled(
        null,
        null,
        { version: null, maxTakeIndex: null },
        T0,
        T0 + 8_000
      )
    ).toBe("waiting");
  });

  it("a lower take index than awaited is not confirmation", () => {
    expect(
      documentSettled(
        3,
        null,
        { version: 2, maxTakeIndex: 2 },
        T0,
        T0 + 4_000
      )
    ).toBe("waiting");
  });

  it("a lower durable version than awaited is not confirmation", () => {
    expect(
      documentSettled(
        3,
        null,
        { version: 2, maxTakeIndex: 1 },
        T0,
        T0 + 4_000
      )
    ).toBe("waiting");
  });

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

  it("the cap runs from the PHASE start, not the upload", () => {
    // A slow analysis must not eat the document phase's budget: at
    // phaseStart + cap - 1ms the phase is still waiting even if the upload
    // began long before.
    expect(
      documentSettled(
        3,
        null,
        { version: null, maxTakeIndex: null },
        T0,
        T0 + DOCUMENT_SETTLE_CAP_MS - 1
      )
    ).toBe("waiting");
  });
});

describe("probeOf", () => {
  it("reads version + newest piece take from a payload", () => {
    expect(
      probeOf({
        version: 4,
        pieces: [{ takeIndex: 1 }, { takeIndex: 3 }, { takeIndex: null }],
      })
    ).toEqual({ version: 4, maxTakeIndex: 3 });
  });

  it("tolerates absent fields as nulls — never as evidence", () => {
    expect(probeOf({})).toEqual({ version: null, maxTakeIndex: null });
    expect(probeOf({ version: null, pieces: [] })).toEqual({
      version: null,
      maxTakeIndex: null,
    });
  });
});
