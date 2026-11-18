import type { PracticeDeliveryLabel } from "@/services/api/trainings";

/** One semantic readiness palette across the project card and practice CTA. */
export const PRACTICE_READINESS_TONE: Record<PracticeDeliveryLabel, string> = {
  "Not yet there": "#d84a3a",
  Almost: "#d6a048",
  Good: "#6e9c6c",
  "Strong delivery": "#6e9c6c",
};
