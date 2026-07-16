import { describe, expect, it } from "vitest";
import { mapCoachStudent } from "./coachStudents";

/* -------------------------------------------------------------------------- */
/*  Locks the roster drill-down key: a row is drillable ONLY when it carries a  */
/*  usable user id, coerced from the BE's id field (whatever it's named). An     */
/*  id-less row maps to id="" so the FE renders it static (no chevron, no tap),  */
/*  instead of a dead click — the "can see students but can't open one" symptom  */
/*  is exactly an id-less roster.                                               */
/* -------------------------------------------------------------------------- */

describe("mapCoachStudent — drill-down id coercion", () => {
  it("prefers user_id, then id, then other common id fields", () => {
    expect(mapCoachStudent({ pseudonym: "Playful Octopus", user_id: "u1" })?.id).toBe("u1");
    expect(mapCoachStudent({ pseudonym: "P", id: 42 })?.id).toBe("42");
    expect(mapCoachStudent({ pseudonym: "P", student_id: "s9" })?.id).toBe("s9");
    expect(mapCoachStudent({ pseudonym: "P", uid: "x7" })?.id).toBe("x7");
  });

  it("leaves id empty (not drillable) when the row has no usable id", () => {
    expect(mapCoachStudent({ pseudonym: "P" })?.id).toBe("");
    expect(mapCoachStudent({ pseudonym: "P", user_id: null })?.id).toBe("");
    expect(mapCoachStudent({ pseudonym: "P", user_id: "" })?.id).toBe("");
  });

  it("maps the rest of the row + rejects a row with no pseudonym", () => {
    const s = mapCoachStudent({
      pseudonym: "Calm Otter",
      user_id: "u2",
      domain: "sales",
      last_active: "2026-06-01T00:00:00Z",
      session_count: 3,
    });
    expect(s).toEqual({
      id: "u2",
      pseudonym: "Calm Otter",
      domain: "sales",
      lastActive: "2026-06-01T00:00:00Z",
      sessionCount: 3,
      idealReady: false,
    });
    expect(mapCoachStudent({ user_id: "u1" })).toBeNull();
  });
});
