/* The leaving words (founder 2026-10-05, N48.4 Q14 A, Q17 A, Q19 A) were
 * signed on the Wave 3 sign-off page (W1 to W5 A, S1 A; backend N50). S1 A
 * switched on the ended state and cancelling; the project window goes on
 * with project Delete itself. This file is the reminder that each switch is
 * a decision, not a cleanup: a flip without the founder's word fails here. */
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETION_CANCEL_ENABLED,
  ENDED_STATE_ENABLED,
  LEAVING_COPY,
  PROJECT_DELETION_WINDOW_ENABLED,
  deletionDate,
  withTrainingLine,
} from "./leavingCopy";

describe("the leaving words", () => {
  it("are on where the founder said so (S1 A), and the project window waits for Delete", () => {
    expect(ENDED_STATE_ENABLED).toBe(true);
    expect(ACCOUNT_DELETION_CANCEL_ENABLED).toBe(true);
    expect(PROJECT_DELETION_WINDOW_ENABLED).toBe(false);
  });

  it("say the signed words exactly", () => {
    expect(LEAVING_COPY.accountDeletedOn("12 October")).toBe(
      "Your account will be deleted on 12 October.",
    );
    expect(LEAVING_COPY.endedOther).toBe("Nothing new is processed for this account.");
    expect(LEAVING_COPY.cancel).toBe("Cancel deletion");
    expect(LEAVING_COPY.cancelled).toBe("Your account will not be deleted.");
    expect(LEAVING_COPY.cancelFailed).toBe("Couldn't cancel. Try again.");
    expect(LEAVING_COPY.cancelTooLate).toBe("It can no longer be cancelled.");
    expect(LEAVING_COPY.accountConfirmBody).toBe(
      "Everything you recorded and wrote here will be permanently deleted after 7 days. Until then you can cancel. From now on nothing new is processed.",
    );
    expect(LEAVING_COPY.projectWindow).toBe(
      "The deletion happens 7 days from now and can't be undone after that. Until then the project is locked, and you can cancel.",
    );
    expect(LEAVING_COPY.projectDeletedOn("12 October")).toBe("Will be deleted on 12 October");
    expect(LEAVING_COPY.trainingModelStays).toBe("A model already trained stays.");
  });
});

describe("withTrainingLine (W5 A)", () => {
  it("adds the signed line only for an active training yes", () => {
    expect(withTrainingLine("Body.", true)).toBe("Body. A model already trained stays.");
    expect(withTrainingLine("Body.", false)).toBe("Body.");
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
