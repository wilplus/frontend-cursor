import { describe, expect, it } from "vitest";
import { mapFounderConfidenceComparison } from "./founderConfidenceComparison";

describe("mapFounderConfidenceComparison", () => {
  it("maps qualitative post-label rows without inventing scores", () => {
    expect(
      mapFounderConfidenceComparison({
        session_id: "session-1",
        rows: [
          {
            snippet_id: "piece-1",
            transcript: "A useful sentence.",
            machine_value: "yes",
            coach_value: "no",
            coach_unrateable: false,
            agreement: false,
            both_confident: false,
          },
        ],
        summary: {
          labelled: 1,
          comparable: 1,
          same: 0,
          different: 1,
          both_confident: 0,
        },
        note: "Machine is a proposal, not a quorum vote.",
      }),
    ).toMatchObject({
      sessionId: "session-1",
      rows: [
        {
          snippetId: "piece-1",
          machineValue: "yes",
          coachValue: "no",
          agreement: false,
        },
      ],
      summary: { same: 0, different: 1 },
    });
  });

  it("rejects a payload that is not a comparison contract", () => {
    expect(mapFounderConfidenceComparison({ rows: [] })).toBeNull();
  });
});
