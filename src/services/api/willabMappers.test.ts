import { describe, expect, it } from "vitest";
import {
  mapReviewQueueRow,
  reconcileReviewQueue,
  groupReviewQueueByStudent,
} from "./reviewQueue";
import type { ReviewQueueRow } from "./reviewQueue";
import { mapCoachReviewSession } from "./coachReview";
import { mapCoachStudent } from "./coachStudents";
import { mapCoachStudentDetail } from "./coachStudentDetail";
import { mapCoachReviewState } from "./coachReviewState";

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
      idealReady: false,
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
  it("maps review_state + arc ideal-ready fields (FE-B/FE-C), junk → safe defaults", () => {
    const d = mapCoachStudentDetail({
      pseudonym: "P",
      sessions: [
        { session_id: "a", review_state: "to_review", arc_id: "arc1", arc_ideal_ready: true },
        { session_id: "b", review_state: "reviewed" },
        { session_id: "c", review_state: "delivered" },
        { session_id: "d", review_state: "garbage", arc_ideal_ready: "yes" },
      ],
    });
    expect(d?.sessions.map((x) => x.reviewState)).toEqual([
      "to_review",
      "reviewed",
      "delivered",
      null,
    ]);
    expect(d?.sessions[0].arcId).toBe("arc1");
    expect(d?.sessions[0].arcIdealReady).toBe(true);
    expect(d?.sessions[3].arcIdealReady).toBe(false);
  });

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
          reviewState: null,
          arcId: null,
          arcIdealReady: false,
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
      userId: null,
      pseudonym: "Playful Octopus",
      domain: "public_speaking",
      topic: "Q3 pitch",
      nSnippets: 8,
      state: "pending",
      sentAt: "2026-06-01T00:00:00Z",
      annotationMode: false,
    });
  });

  it("maps user_id when present (FP-4 / BE-4)", () => {
    expect(
      mapReviewQueueRow({ session_id: "s", user_id: "u-42" })?.userId
    ).toBe("u-42");
    expect(mapReviewQueueRow({ session_id: "s", user_id: "" })?.userId).toBeNull();
  });

  it("defaults missing optionals + clamps unknown state to pending", () => {
    expect(
      mapReviewQueueRow({
        session_id: "s",
        state: "weird",
      })
    ).toEqual({
      sessionId: "s",
      userId: null,
      pseudonym: "",
      domain: "",
      topic: "",
      nSnippets: 0,
      state: "pending",
      sentAt: "",
      annotationMode: false,
    });
  });

  it("maps annotation_mode true (T4 — coach annotation upload)", () => {
    expect(
      mapReviewQueueRow({ session_id: "s", annotation_mode: true })
        ?.annotationMode
    ).toBe(true);
    // strict-bool: a truthy-but-not-true value is not an annotation.
    expect(
      mapReviewQueueRow({ session_id: "s", annotation_mode: 1 })?.annotationMode
    ).toBe(false);
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
    userId: null,
    pseudonym: "P",
    domain: "public_speaking",
    topic: "t",
    nSnippets: 1,
    state,
    sentAt: "2026-06-01T00:00:00Z",
    annotationMode: false,
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

describe("groupReviewQueueByStudent (FP-4)", () => {
  const row = (
    sessionId: string,
    over: Partial<ReviewQueueRow> = {}
  ): ReviewQueueRow => ({
    sessionId,
    userId: null,
    pseudonym: "P",
    domain: "public_speaking",
    topic: "t",
    nSnippets: 1,
    state: "pending",
    sentAt: "2026-06-01T00:00:00Z",
    annotationMode: false,
    ...over,
  });

  it("collapses a student's sessions into one group, FIFO within", () => {
    const groups = groupReviewQueueByStudent([
      row("a", { userId: "u1", sentAt: "2026-06-03T00:00:00Z" }),
      row("b", { userId: "u1", sentAt: "2026-06-01T00:00:00Z" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("u:u1");
    expect(groups[0].userId).toBe("u1");
    expect(groups[0].rows.map((r) => r.sessionId)).toEqual(["b", "a"]);
    expect(groups[0].earliestSentAt).toBe("2026-06-01T00:00:00Z");
  });

  it("falls back to grouping by pseudonym when no user_id (pre-BE-4)", () => {
    const groups = groupReviewQueueByStudent([
      row("a", { pseudonym: "Alice" }),
      row("b", { pseudonym: "Alice" }),
      row("c", { pseudonym: "Bob" }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["p:Alice", "p:Bob"]);
    expect(groups[0].userId).toBeNull();
    expect(groups[0].rows).toHaveLength(2);
  });

  it("counts only not-done rows and rolls up the group state", () => {
    const g = groupReviewQueueByStudent([
      row("a", { userId: "u1", state: "done" }),
      row("b", { userId: "u1", state: "in_progress" }),
      row("c", { userId: "u1", state: "pending" }),
    ])[0];
    expect(g.toReviewCount).toBe(2);
    expect(g.state).toBe("pending"); // any pending → group pending
  });

  it("rolls up to done only when every session is done", () => {
    const g = groupReviewQueueByStudent([
      row("a", { userId: "u1", state: "done" }),
      row("b", { userId: "u1", state: "done" }),
    ])[0];
    expect(g.toReviewCount).toBe(0);
    expect(g.state).toBe("done");
  });

  it("keeps distinct students in first-appearance order", () => {
    const groups = groupReviewQueueByStudent([
      row("a", { userId: "u2" }),
      row("b", { userId: "u1" }),
    ]);
    expect(groups.map((g) => g.userId)).toEqual(["u2", "u1"]);
  });

  it("keeps annotation rows OUT of a student's group (T4)", () => {
    // Same user_id, but one row is a coach annotation upload — it must never
    // fold into the student's bubble; it keys by its own session and is flagged.
    const groups = groupReviewQueueByStudent([
      row("take", { userId: "u1" }),
      row("anno", { userId: "u1", annotationMode: true }),
    ]);
    expect(groups).toHaveLength(2);
    const student = groups.find((g) => !g.annotationMode);
    const anno = groups.find((g) => g.annotationMode);
    expect(student?.userId).toBe("u1");
    expect(student?.rows.map((r) => r.sessionId)).toEqual(["take"]);
    expect(anno?.key).toBe("a:anno");
    expect(anno?.rows.map((r) => r.sessionId)).toEqual(["anno"]);
    // The annotation must NOT inherit the student's id, or a tap would open the
    // student's roster detail instead of the annotation (review R-t4).
    expect(anno?.userId).toBeNull();
  });
});

describe("mapCoachReviewState (FE-2)", () => {
  it("maps the full contract snake → camel", () => {
    const s = mapCoachReviewState({
      arc_id: "arc1",
      published: false,
      takes: [
        {
          session_id: "s1",
          take_index: 1,
          review_state: "reviewed",
          has_reread: true,
        },
      ],
      takes_saved: 3,
      takes_total: 3,
      takes_target: 3,
      ideal: {
        assembly_state: "ready",
        ready: true,
        approved: false,
        source: "machine",
        takes_done: 3,
      },
      can_publish: false,
      blockers: [],
      advisories: ["IDEAL_TEXT_NOT_APPROVED"],
      pending_session_ids: [],
    });
    expect(s).toEqual({
      arcId: "arc1",
      published: false,
      takes: [
        {
          sessionId: "s1",
          takeIndex: 1,
          reviewState: "reviewed",
          hasReread: true,
        },
      ],
      takesSaved: 3,
      takesTotal: 3,
      takesTarget: 3,
      ideal: {
        assemblyState: "ready",
        ready: true,
        approved: false,
        source: "machine",
        takesDone: 3,
      },
      canPublish: false,
      blockers: [],
      advisories: ["IDEAL_TEXT_NOT_APPROVED"],
      pendingSessionIds: [],
    });
  });

  it("defaults safely + drops junk takes / blockers", () => {
    const s = mapCoachReviewState({
      arc_id: "arc2",
      takes: [{ take_index: 2 }, { session_id: "s2" }], // first has no session_id
      blockers: ["NO_TAKES", "bogus"],
      advisories: ["TAKES_NOT_SAVED", "nonsense"],
    });
    expect(s?.published).toBe(false);
    expect(s?.takes).toEqual([
      { sessionId: "s2", takeIndex: null, reviewState: null, hasReread: false },
    ]);
    expect(s?.ideal.assemblyState).toBeNull();
    expect(s?.ideal.approved).toBe(false);
    expect(s?.canPublish).toBe(false);
    expect(s?.blockers).toEqual(["NO_TAKES"]);
    // Advisories parse on their own allowlist and drop junk the same way.
    expect(s?.advisories).toEqual(["TAKES_NOT_SAVED"]);
  });

  it("returns null on a non-object", () => {
    expect(mapCoachReviewState(null)).toBeNull();
    expect(mapCoachReviewState("nope")).toBeNull();
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
      speechRatePct: 120, // fallback: Math.round(150/125*100)
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

describe("mapCoachReviewSession — neutral auto_comment", () => {
  it("maps a neutral observation without interpreting legacy acoustic reads", () => {
    const s = mapCoachReviewSession({
      session_id: "s",
      snippets: [
        {
          id: "n1",
          acoustic_read: { potentiometer: 1.8, outside_normal_range: true },
          auto_comment: "The pace was steadier than nearby moments.",
        },
      ],
    });
    expect(s?.snippets[0].autoComment).toBe(
      "The pace was steadier than nearby moments."
    );
    expect(s?.snippets[0]).not.toHaveProperty("acousticRead");
  });

  it("nulls auto_comment when absent or malformed", () => {
    const s = mapCoachReviewSession({
      session_id: "s",
      snippets: [
        { id: "n1" },
        { id: "n2", auto_comment: 12 },
      ],
    });
    expect(s?.snippets[0].autoComment).toBeNull();
    expect(s?.snippets[1].autoComment).toBeNull();
  });
});

describe("mapCoachReviewSession — recording_kind (#191)", () => {
  it("labels spoken / read and defaults unknown to null", () => {
    const s = mapCoachReviewSession({
      session_id: "s",
      snippets: [
        { id: "n1", recording_kind: "spoken" },
        { id: "n2", recording_kind: "read" },
        { id: "n3" },
        { id: "n4", recording_kind: "garbage" },
      ],
    });
    // Assert by id, not index — FP-5 reorders reads to the tail.
    const byId = (id: string) => s?.snippets.find((n) => n.id === id);
    expect(byId("n1")?.recordingKind).toBe("spoken");
    expect(byId("n2")?.recordingKind).toBe("read");
    expect(byId("n3")?.recordingKind).toBeNull();
    expect(byId("n4")?.recordingKind).toBeNull();
  });
});

describe("mapCoachReviewSession — re-read ordering (FP-5)", () => {
  it("slide-orders spoken snippets but keeps reads appended in BE order", () => {
    const s = mapCoachReviewSession({
      session_id: "s",
      snippets: [
        // Out of slide order + a read interleaved among the spoken rows.
        { id: "spoken-b", recording_kind: "spoken", slide: { index: 2 } },
        { id: "read-x", recording_kind: "read", slide: { index: 1 } },
        { id: "spoken-a", recording_kind: "spoken", slide: { index: 1 } },
        { id: "read-y", recording_kind: "read", slide: { index: 2 } },
      ],
    });
    // Spoken sorted by slide (a before b); reads NOT sorted into them — kept in
    // BE append order at the tail (x before y), even though read-x's slide is 1.
    expect(s?.snippets.map((n) => n.id)).toEqual([
      "spoken-a",
      "spoken-b",
      "read-x",
      "read-y",
    ]);
  });

  it("maps take_session_id → takeSessionId (null when absent)", () => {
    const s = mapCoachReviewSession({
      session_id: "s",
      snippets: [
        { id: "n1", take_session_id: "take-7" },
        { id: "n2" },
      ],
    });
    const byId = (id: string) => s?.snippets.find((n) => n.id === id);
    expect(byId("n1")?.takeSessionId).toBe("take-7");
    expect(byId("n2")?.takeSessionId).toBeNull();
  });
});
