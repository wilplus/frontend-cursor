/* The leaving words (founder 2026-10-05, N48.4 Q14 A, Q17 A, Q19 A) are
 * PROPOSED: every surface that shows them stays off until the founder signs.
 * This file is the reminder that flipping one is a decision, not a cleanup:
 * a flip without the founder's word on the strings fails here first. */
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETION_CANCEL_ENABLED,
  ENDED_STATE_ENABLED,
  PROJECT_DELETION_WINDOW_ENABLED,
  deletionDate,
} from "./leavingCopy";

describe("the leaving words", () => {
  it("are all off until the founder signs them", () => {
    expect(ENDED_STATE_ENABLED).toBe(false);
    expect(ACCOUNT_DELETION_CANCEL_ENABLED).toBe(false);
    expect(PROJECT_DELETION_WINDOW_ENABLED).toBe(false);
  });
});

describe("deletionDate", () => {
  // Local noon, so the day is the same in every time zone a test runs in.
  const now = new Date(2026, 9, 5, 12, 0, 0);

  it("is the day, in words, in the reader's time zone", () => {
    expect(deletionDate(new Date(2026, 9, 12, 12, 0, 0).toISOString(), now))
      .toBe("12 October");
  });

  it("is nothing for a missing, unreadable or past moment", () => {
    expect(deletionDate(null, now)).toBeNull();
    expect(deletionDate("not a date", now)).toBeNull();
    expect(deletionDate(new Date(2026, 9, 5, 11, 59, 59).toISOString(), now)).toBeNull();
  });
});
