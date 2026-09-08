export interface Mlc2ConsentStatus {
  applicable: boolean;
  configured: boolean;
  granted: boolean;
  speaker_bound: boolean;
  consent_policy_version: string | null;
  required_for_service: boolean;
  bundled_ui: boolean;
  approval_reference: string | null;
  approved_copy_sha256: string | null;
  onboarding_copy: string | null;
  terms_version: string | null;
  privacy_policy_version: string | null;
  article_6_basis: string | null;
  article_9_treatment: string | null;
}

/** UI optimization only; the backend independently verifies the JWT email. */
export const MLC2_FOUNDER_CANARY_EMAIL = "artur@willonski.com";

interface ErrorEnvelope {
  code?: string;
  error?: string;
}

const PHASE2_DISABLED_STATUS: Mlc2ConsentStatus = {
  applicable: false,
  configured: false,
  granted: false,
  speaker_bound: false,
  consent_policy_version: null,
  required_for_service: false,
  bundled_ui: false,
  approval_reference: null,
  approved_copy_sha256: null,
  onboarding_copy: null,
  terms_version: null,
  privacy_policy_version: null,
  article_6_basis: null,
  article_9_treatment: null,
};

async function readStatus(
  response: Response,
  options: { phase2DisabledIsNotApplicable?: boolean } = {},
): Promise<Mlc2ConsentStatus> {
  const payload = (await response.json().catch(() => ({}))) as
    | Mlc2ConsentStatus
    | ErrorEnvelope;
  if (!response.ok) {
    if (
      options.phase2DisabledIsNotApplicable === true &&
      response.status === 410 &&
      "code" in payload &&
      payload.code === "PHASE2_DISABLED"
    ) {
      return PHASE2_DISABLED_STATUS;
    }
    throw new Error(
      "error" in payload && payload.error
        ? payload.error
        : "Consent service is unavailable.",
    );
  }
  return payload as Mlc2ConsentStatus;
}

export async function fetchMlc2Consent(): Promise<Mlc2ConsentStatus> {
  return readStatus(
    await fetch("/api/v2/user/mlc2-consent", {
      method: "GET",
      cache: "no-store",
    }),
    { phase2DisabledIsNotApplicable: true },
  );
}

export async function grantMlc2Consent(
  status: Mlc2ConsentStatus,
): Promise<Mlc2ConsentStatus> {
  return readStatus(
    await fetch("/api/v2/user/mlc2-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accepted: true,
        idempotency_key: crypto.randomUUID(),
        consent_policy_version: status.consent_policy_version,
        copy_sha256: status.approved_copy_sha256,
      }),
    }),
  );
}

export async function withdrawMlc2Consent(): Promise<Mlc2ConsentStatus> {
  return readStatus(
    await fetch("/api/v2/user/mlc2-consent", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idempotency_key: crypto.randomUUID() }),
    }),
  );
}
