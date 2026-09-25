/* -------------------------------------------------------------------------- */
/*  The choices a person can change after accepting (founder 2026-09-25).    */
/*                                                                            */
/*  personalised_practice — the one optional tick. Turning it off stops       */
/*  exercises being chosen from their recordings and deletes their practice   */
/*  recordings.                                                                */
/*  sensitive_information — the consent the required tick gives. Withdrawing  */
/*  it stops new recording only; reading and exporting are untouched, and    */
/*  agreeing again resumes it.                                                 */
/*                                                                            */
/*  Backend: GET/POST /v2/processing-authorization/choices, the one boundary  */
/*  that decides. Nothing here decides anything; it reads and sends.          */
/* -------------------------------------------------------------------------- */
import { GUEST_OWNER_HEADER, readGuestOwnerToken } from "./projects";

export type ConsentChoice = "personalised_practice" | "sensitive_information";

export interface ConsentChoices {
  /** False when there is no accepted agreement to change yet. */
  hasReceipt: boolean;
  personalisedPractice: boolean;
  sensitiveInformation: boolean;
  /** Present only after turning practice off: false while deletion is still
   *  finishing in the background. */
  practiceErasureComplete: boolean | null;
}

function headers(): Record<string, string> {
  const token = readGuestOwnerToken();
  return token ? { [GUEST_OWNER_HEADER]: token } : {};
}

export function mapConsentChoices(raw: unknown): ConsentChoices | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.has_receipt !== "boolean") return null;
  const erasure = r.practice_erasure && typeof r.practice_erasure === "object"
    ? (r.practice_erasure as Record<string, unknown>).complete
    : null;
  return {
    hasReceipt: r.has_receipt,
    personalisedPractice: r.personalised_practice === true,
    sensitiveInformation: r.sensitive_information === true,
    practiceErasureComplete: typeof erasure === "boolean" ? erasure : null,
  };
}

/** The choices in force, or null when they could not be read. */
export async function fetchConsentChoices(): Promise<ConsentChoices | null> {
  try {
    const res = await fetch("/api/v2/processing-authorization/choices", {
      method: "GET",
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return mapConsentChoices(await res.json().catch(() => null));
  } catch {
    return null;
  }
}

function idempotencyKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `choice-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** Change one choice. Returns the choices now in force, or null on failure. */
export async function setConsentChoice(
  choice: ConsentChoice,
  enabled: boolean,
): Promise<ConsentChoices | null> {
  try {
    const res = await fetch("/api/v2/processing-authorization/choices", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers() },
      body: JSON.stringify({
        choice,
        enabled,
        idempotency_key: idempotencyKey(),
        client_version: "web",
      }),
    });
    if (!res.ok) return null;
    return mapConsentChoices(await res.json().catch(() => null));
  } catch {
    return null;
  }
}
