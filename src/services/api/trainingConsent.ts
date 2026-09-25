/* -------------------------------------------------------------------------- */
/*  The training switch (SPEC-training-corpus §3; founder 2026-09-26, N10).   */
/*                                                                            */
/*  Backend: GET/POST/DELETE /v2/user/training-consent. It answers 410 until  */
/*  the switch is turned on in the backend's code, and "available: false"    */
/*  until a training policy exists; either way this returns null or an       */
/*  unavailable state, and the card is not shown. The switch's sentence      */
/*  comes from the backend, which holds the exact wording the yes is         */
/*  fingerprinted against. Nothing here decides anything.                    */
/* -------------------------------------------------------------------------- */

export interface TrainingConsent {
  available: boolean;
  active: boolean;
  policyVersion: string | null;
  /** The approved sentence, exactly as the database holds it. */
  copy: string | null;
  copySha256: string | null;
}

export function mapTrainingConsent(raw: unknown): TrainingConsent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.available !== "boolean") return null;
  const text = (value: unknown) => (typeof value === "string" && value ? value : null);
  const state = {
    available: r.available,
    active: r.active === true,
    policyVersion: text(r.policy_version),
    copy: text(r.copy),
    copySha256: text(r.copy_sha256),
  };
  // Available without the wording to show is not something to offer.
  if (state.available && (!state.policyVersion || !state.copy || !state.copySha256)) {
    return { ...state, available: false };
  }
  return state;
}

/** The switch's state, or null when it is closed or could not be read. */
export async function fetchTrainingConsent(): Promise<TrainingConsent | null> {
  try {
    const res = await fetch("/api/v2/user/training-consent", {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return mapTrainingConsent(await res.json().catch(() => null));
  } catch {
    return null;
  }
}

function idempotencyKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `training-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** Turn training on or off. Returns the state now in force, or null. */
export async function setTrainingConsent(
  on: boolean,
  shown: TrainingConsent,
): Promise<TrainingConsent | null> {
  const body = on
    ? {
        accepted: true,
        policy_version: shown.policyVersion,
        copy_sha256: shown.copySha256,
        idempotency_key: idempotencyKey(),
      }
    : { idempotency_key: idempotencyKey() };
  try {
    const res = await fetch("/api/v2/user/training-consent", {
      method: on ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return mapTrainingConsent(await res.json().catch(() => null));
  } catch {
    return null;
  }
}
