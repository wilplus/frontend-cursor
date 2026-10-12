/* The leaving words (founder 2026-10-05, N48.4 Q14 A, Q17 A, Q19 A) were
 * signed on the Wave 3 sign-off page (W1 to W5 A, S1 A; backend N50). S1 A
 * switched on the ended state and cancelling; the project window goes on
 * with project Delete itself. This file is the reminder that each switch is
 * a decision, not a cleanup: a flip without the founder's word fails here. */
import { describe, expect, it } from "vitest";
import {
  LEAVING_COPY,
} from "./leavingCopy";

describe("the leaving words", () => {

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
