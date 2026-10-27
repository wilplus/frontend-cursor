import { outcomeCall as call, type Outcome } from "@/lib/api/bffCall";

/* The plan's own yes, for the card in Data & consent (founder 2026-10-27,
   backend N211; rules: docs/flows/the-plan.md D). Backend: GET and POST
   /v2/plan/consent. ``enabled`` is false for everyone the switch or the ring
   does not reach, and the card is not shown. Will's own ask in the Lounge goes
   through services/api/plan.ts. */

export type PlanConsentState = "granted" | "declined" | "unanswered";

export interface PlanConsent {
  enabled: boolean;
  state: PlanConsentState;
}

export function mapPlanConsent(data: Record<string, unknown>): PlanConsent {
  const state = data.state === "granted" || data.state === "unanswered" ? data.state : "declined";
  return { enabled: data.enabled === true, state };
}

const PATH = "/api/v2/plan/consent";

export function readPlanConsent(): Promise<Outcome<PlanConsent>> {
  return call(PATH, { method: "GET" }, mapPlanConsent);
}

/** The card's Turn on, or Turn off (which deletes the personal answers). */
export function setPlanConsent(on: boolean): Promise<Outcome<PlanConsent>> {
  return call(PATH, { method: "POST", body: { on } }, mapPlanConsent);
}
