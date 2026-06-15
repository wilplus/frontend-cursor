import { describe, expect, it } from "vitest";
import { mapReviewQueueRow, reconcileReviewQueue } from "./reviewQueue";
import type { ReviewQueueRow } from "./reviewQueue";
import { mapLibraryEntry } from "./library";
import { mapCoachReviewSession } from "./coachReview";
import { mapCoachStudent } from "./coachStudents";
import { mapCoachStudentDetail } from "./coachStudentDetail";

describe("mapCoachStudent (E3)", () => {
  it("maps snake → camel, pseudonymized, with id + sessionCount", () => {
    expect(
      mapCoachStudent({
        user_id: "u_123",
        pseudonym: "Playful Octopus",
        domain: "sales",
        last_active: "2026-06-08T00:00:00Z",
        session_count: 7,
      })
    ).toEqual({
      id: "u_123",
      pseudonym: "Playful Octopus",
      domain: "sales",
      lastActive: "2026-06-08T00:00:00Z",
      sessionCount: 7,
    });
  });

  it("coerces a numeric id and prefers user_id over id", () => {
    expect(mapCoachStudent({ pseudonym: "P", user_id: 42 })?.id).toBe("42");
    expect(
      mapCoachStudent({ pseudonym: "P", user_id: "u_1", id: "z_9" })?.id
    ).toBe("u_1");
    expect(mapCoachStudent({ pseudonym: "P", id: "fallback" })?.id).toBe(
      "fallback"
    );
  });

  it("omits sessionCount when absent and defaults optionals (incl. empty id)", () => {
    const s = mapCoachStudent({ pseudonym: "Calm Otter" });
    expect(s?.id).toBe("");
    expect(s?.pseudonym).toBe("Calm Otter");
    expect(s?.domain).toBe("");
    expect(s?.lastActive).toBe("");
    expect(s?.sessionCount).toBeUndefined();
  });

  it("rejects a row with no pseudonym (no identity to show)", () => {
    expect(mapCoachStudent({ domain: "sales" })).toBeNull();
    expect(mapCoachStudent(null)).toBeNull();
  });
});

describe("mapCoachStudentDetail (E-1b / S6)", () => {
  it("maps the pseudonymized detail + session history", () => {
    expect(
      mapCoachStudentDetail({
        pseudonym: "Playful Octopus",
        domain: "sales",
        goal: "close bigger deals",
        sessions: [
          {
            session_id: "s1",
            topic: "Q3 pitch",
            created_at: "2026-06-01T00:00:00Z",
            state: "done",
          },
        ],
      })
    ).toEqual({
      pseudonym: "Playful Octopus",
      domain: "sales",
      goal: "close bigger deals",
      previousGoal: null,
      goalChangedAt: null,
      sessions: [
        {
          sessionId: "s1",
          topic: "Q3 pitch",
          createdAt: "2026-06-01T00:00:00Z",
          state: "done",
          feeling: null,
        },
      ],
    });
  });

  it("defaults optionals + empties a missing session list", () => {
    expect(mapCoachStudentDetail({ pseudonym: "Calm Otter" })).toEqual({
      pseudonym: "Calm Otter",
      domain: "",
      goal: "",
      previousGoal: null,
      goalChangedAt: null,
      sessions: [],
    });
  });

  it("drops malformed sessions + rejects a row with no pseudonym", () => {
    const d = mapCoachStudentDetail({
      pseudonym: "P",
      sessions: [{ topic: "no id" }, { session_id: "ok" }],
    });
    expect(d?.sessions.map((s) => s.sessionId)).toEqual(["ok"]);
    expect(mapCoachStudentDetail({ domain: "sales" })).toBeNull();
    expect(mapCoachStudentDetail(null)).toBeNull();
  });
});

describe("mapReviewQueueRow", () => {
  it("maps snake → camel (§B.1 shape)", () => {
    expect(
      mapReviewQueueRow({
        session_id: "s",
        pseudonym: "Playful Octopus",
        domain: "public_speaking",
        topic: "Q3 pitch",
        n_snippets: 8,
        state: "pending",
        sent_at: "2026-06-01T00:00:00Z",
      })
    ).toEqual({
      sessionId: "s",
      pseudonym: "Playful Octopus",
      domain: "public_speaking",
      topic: "Q3 pitch",
      nSnippets: 8,
      state: "pending",
      sentAt: "2026-06-01T00:00:00Z",
    });
  });

  it("defaults missing optionals + clamps unknown state to pending", () => {
    expect(
      mapReviewQueueRow({
        session_id: "s",
        state: "weird",
      })
    ).toEqual({
      sessionId: "s",
      pseudonym: "",
      domain: "",
      topic: "",
      nSnippets: 0,
      state: "pending",
      sentAt: "",
    });
  });

  it("accepts in_progress and done states", () => {
    expect(
      mapReviewQueueRow({ session_id: "s", state: "in_progress" })?.state
    ).toBe("in_progress");
    expect(mapReviewQueueRow({ session_id: "s", state: "done" })?.state).toBe(
      "done"
    );
  });

  it("returns null without a session_id", () => {
    expect(mapReviewQueueRow({ topic: "t" })).toBeNull();
    expect(mapReviewQueueRow(null)).toBeNull();
  });
});

describe("reconcileReviewQueue (C2)", () => {
  const row = (
    sessionId: string,
    state: ReviewQueueRow["state"] = "pending"
  ): ReviewQueueRow => ({
    sessionId,
    pseudonym: "P",
    domain: "public_speaking",
    topic: "t",
    nSnippets: 1,
    state,
    sentAt: "2026-06-01T00:00:00Z",
  });

  it("retains a published row the BE dropped on refresh, as done", () => {
    const out = reconcileReviewQueue([row("a")], [row("b", "done")]);
    expect(out.map((r) => `${r.sessionId}:${r.state}`)).toEqual([
      "a:pending",
      "b:done",
    ]);
  });

  it("coerces a still-present published row to done (BE lag)", () => {
    expect(
      reconcileReviewQueue([row("b", "in_progress")], [row("b", "done")])
    ).toEqual([row("b", "done")]);
  });

  it("passes rows through unchanged when nothing is published", () => {
    const next = [row("a"), row("b", "in_progress")];
    expect(reconcileReviewQueue(next, [])).toEqual(next);
  });
});

describe("mapLibraryEntry", () => {
  it("maps snake → camel (snippet null when no snippet_ref)", () => {
    expect(
      mapLibraryEntry({
        id: "x",
        session_id: "s",
        snippet_id: "n1",
        note: "great open",
        tag: "strong",
        created_at: "t",
      })
    ).toEqual({
      id: "x",
      sessionId: "s",
      snippetId: "n1",
      note: "great open",
      tag: "strong",
      createdAt: "t",
      snippet: null,
    });
  });

  it("parses snippet_ref into the playable clip (FE-6 / T7)", () => {
    const e = mapLibraryEntry({
      id: "x",
      session_id: "s",
      snippet_id: "n1",
      note: "strong open",
      tag: "strong",
      created_at: "t",
      snippet_ref: {
        audio_ref: "https://cdn/full.webm",
        start_offset_ms: 1200,
        duration_ms: 6000,
        transcript: "…and that's when I realized…",
      },
    });
    expect(e?.snippet).toEqual({
      audioRef: "https://cdn/full.webm",
      startOffsetMs: 1200,
      durationMs: 6000,
      transcript: "…and that's when I realized…",
    });
  });

  it("drops an invalid tag to null and rejects a row without an id", () => {
    expect(mapLibraryEntry({ id: "x", tag: "weird" })?.tag).toBeNull();
    expect(mapLibraryEntry({ note: "no id" })).toBeNull();
  });
});

describe("mapCoachReviewSession — features (C1 / §B.1)", () => {
  it("parses the per-snippet acoustic vector (snake→camel, mean_pause_seconds → meanPause)", () => {
    const s = mapCoachReviewSession({
      session_id: "s",
      snippets: [
        {
          id: "n1",
          features: {
            f0_mean: 180,
            f0_sd: 30,
            speech_rate: 150,
            mean_pause_seconds: 0.4,
            pause_ratio: 0.3,
            loudness_range: 14,
            voiced_ratio: 0.7,
            f0_slope: -2,
            pause_regularity: 0.6,
            intensity_envelope: 0.5,
            f0_mid_end_delta: -8,
          },
        },
      ],
    });
    expect(s?.snippets[0].features).toEqual({
      f0Mean: 180,
      f0Sd: 30,
      speechRate: 150,
      meanPause: 0.4,
      pauseRatio: 0.3,
      loudnessRange: 14,
      voicedRatio: 0.7,
      f0Slope: -2,
      pauseRegularity: 0.6,
      intensityEnvelope: 0.5,
      f0MidEndDelta: -8,
    });
  });

  it("nulls features when the packet omits them (no all-null panel)", () => {
    const s = mapCoachReviewSession({
      session_id: "s",
      snippets: [{ id: "n1" }],
    });
    expect(s?.snippets[0].features).toBeNull();
  });
});
