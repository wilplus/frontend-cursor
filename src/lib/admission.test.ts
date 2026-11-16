/*
STORY    As an invited early tester, I want the one admission URL to be stable,
         so that every valid invitation opens the speaking-coach welcome.
OUTCOME  O1  Only the founder-approved token is admitted.
PROVES   O1 -> "accepts only the founder-approved admission link"
WHY      Founder 2026-11-15: this is the app's only admission link.
*/
import { describe, expect, it } from "vitest";

import {
  EARLY_COACH_ADMISSION_PATH,
  EARLY_COACH_ADMISSION_TOKEN,
  isEarlyCoachAdmissionToken,
} from "./admission";

describe("the early speaking-coach admission door", () => {
  it("accepts only the founder-approved admission link", () => {
    expect(EARLY_COACH_ADMISSION_PATH).toBe("/c/xLl2I4B-u14RY5yZd1JSR-4K");
    expect(isEarlyCoachAdmissionToken(EARLY_COACH_ADMISSION_TOKEN)).toBe(true);
    expect(isEarlyCoachAdmissionToken("another-persons-link")).toBe(false);
  });
});
