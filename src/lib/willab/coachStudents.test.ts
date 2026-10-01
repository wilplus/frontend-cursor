/* Phase 0b (founder 2026-10-01): the students mappers. Pins: a real name
 * rides only when the backend sends it; the walk-take maps to the queue's own
 * shape and takes the name as its label; the switch is off. */
import { describe, expect, it } from "vitest";
import {
  COACH_STUDENTS_ENABLED, mapCoachStudentProfile, mapCoachStudents, mapWalkTake, studentLabel,
} from "./coachStudents";

describe("the switch", () => {
  it("is off until a reviewed change flips it", () => {
    expect(COACH_STUDENTS_ENABLED).toBe(false);
  });
});

describe("the roster", () => {
  it("keeps the pseudonym and takes the real name only when sent", () => {
    const out = mapCoachStudents([
      { user_id: "u1", pseudonym: "Quiet Heron", domain: "sales", last_active: "2026-10-01", session_count: 3 },
      { user_id: "u2", pseudonym: "Calm Otter", name: " Anna ", domain: "" },
      { pseudonym: "" },
      "junk",
    ]);
    expect(out.map(studentLabel)).toEqual(["Quiet Heron", "Anna"]);
    expect(out[0].name).toBeNull();
    expect(out[0].sessionCount).toBe(3);
    expect(out[1].sessionCount).toBeNull();
  });
});

describe("the profile", () => {
  it("lists the Takes newest first and never a reviewed, delivered or ideal-ready state", () => {
    const p = mapCoachStudentProfile({
      pseudonym: "Quiet Heron", goal: "Sound calm", previous_goal: "",
      sessions: [
        { session_id: "t1", take_index: 1, topic: "Board", created_at: "2026-09-01", arc_id: "a", review_state: "delivered" },
        { session_id: "t2", take_index: 2, topic: "Board", created_at: "2026-09-02", arc_id: "a", arc_ideal_ready: true },
        { topic: "no id" },
      ],
    });
    expect(p?.takes.map((t) => t.sessionId)).toEqual(["t2", "t1"]);
    expect(p?.previousGoal).toBeNull();
    expect(JSON.stringify(p)).not.toMatch(/review|ideal|delivered/i);
  });
});

describe("the walk-take", () => {
  it("is the queue's shape with the real name as the label", () => {
    const out = mapWalkTake({
      name: "Anna",
      speaker: { pseudonym: "Quiet Heron", waiting: 1, takes: [{
        session_id: "t2", take_index: 2, sent_at: "2026-10-01T09:00:00Z", waiting: 1,
        moments: [{ snippet_id: "s1", state: "judge_it" }],
      }] },
    });
    expect(out?.speaker.pseudonym).toBe("Anna");
    expect(out?.take.moments[0]).toEqual({ snippetId: "s1", state: "judge_it", kind: null });
    expect(mapWalkTake({ speaker: { pseudonym: "x", takes: [] } })).toBeNull();
  });
});
