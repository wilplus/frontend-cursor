/*
STORY    As a coach labelling clips, I want never to see the machine's rating
         or score, so that my judgement stays blind.
OUTCOME
  O1  The clips I label carry no machine rating or score, even if the
      server sent one.
PROVES   O1 -> "never surfaces a band or machine read even if one were served (N1)"
WHY      Never-rule 2: no coach sees the machine's guess before answering.
*/
import { describe, expect, it } from "vitest";
import {
  mapConfidenceQueue,
} from "./trainingCorpus";

function piece(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    snippet_id: "snip-1",
    transcript: "and that is when everything changed for us",
    session_id: "sess-1",
    label: null,
    ...over,
  };
}

describe("mapConfidenceQueue", () => {

  it("never surfaces a band or machine read even if one were served (N1)", () => {
    const m = mapConfidenceQueue({
      session_id: "s",
      queue: [piece({ band: "high", confidence_score: 0.91 })],
    });
    expect(JSON.stringify(m)).not.toContain("band");
    expect(JSON.stringify(m)).not.toContain("confidence_score");
  });
});
