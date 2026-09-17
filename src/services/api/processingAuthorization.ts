import { GUEST_OWNER_HEADER, readGuestOwnerToken } from "./projects";

/* -------------------------------------------------------------------------- */
/*  Phase-1 processing authorization — the client half (Task 3).               */
/*                                                                            */
/*  THE ONE RULE THIS FILE EXISTS TO HOLD: the copy and its hash are DATA that */
/*  arrive together from the policy record, travel together, and go back       */
/*  together unchanged. This module never stores policy text, never derives a  */
/*  hash, and offers no way for a caller to do either.                         */
/*                                                                            */
/*  Why that is not merely tidy: `accept_phase1_processing_authorization_v1`   */
/*  compares the four hashes the client sends against the four the policy      */
/*  stores and raises PROCESSING_POLICY_STALE on any disagreement. That check  */
/*  is the entire protection against a user's receipt proving agreement to     */
/*  words they never saw. A client that recomputed sha256 from the text it     */
/*  happened to be holding would pass that check every single time, including  */
/*  the time it mattered — it would be verifying its own copy against itself.  */
/* -------------------------------------------------------------------------- */

/** One version + copy + hash triple, exactly as the policy record stores it. */
export interface PolicyDocument {
  version: string;
  copy: string;
  sha256: string;
}

export interface ProcessingPolicy {
  policyId: string;
  policyVersion: string;
  terms: PolicyDocument;
  privacy: PolicyDocument;
  aiNotice: PolicyDocument;
  /** The acceptance screen's own words. It has a hash but no version of its
   *  own — the policy version is its version. */
  agreementCopy: string;
  agreementCopySha256: string;
  /** Lowercase, exact-match. The RPC compares what we send against this array
   *  character for character and raises COUNTRY_NOT_ALLOWED otherwise. */
  allowedCountries: string[];
  minimumAge: number;
  /** Whether an ai_transparency_exposures row already exists for this exact
   *  notice version and principal. */
  aiNoticeRendered: boolean;
}

export type AuthorizationStatus =
  /** A policy is active and this principal has a usable receipt for it. */
  | { kind: "authorized"; policy: ProcessingPolicy }
  /** A policy is active and acceptance is what is missing. Render the screen. */
  | { kind: "acceptance_required"; policy: ProcessingPolicy; code: string }
  /** No active policy, or the gate could not be read. NOT the same as
   *  "acceptance required": there is nothing to accept, and presenting an
   *  empty screen would be inventing a policy. */
  | { kind: "unavailable"; code: string }
  /** The request itself failed. Distinct from `unavailable` so a caller can
   *  retry rather than conclude anything about the policy. */
  | { kind: "error"; message: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function document(
  row: Record<string, unknown>,
  prefix: string,
): PolicyDocument | null {
  const doc = {
    version: str(row[`${prefix}_version`]),
    copy: str(row[`${prefix}_copy`]),
    sha256: str(row[`${prefix}_copy_sha256`]),
  };
  // ALL THREE OR NONE. A document missing its hash cannot be accepted (the RPC
  // would reject it) and one missing its copy must not be shown as an empty
  // page the user then agrees to. Partial is not a lesser version of complete
  // here; it is unusable.
  return doc.version && doc.copy && doc.sha256 ? doc : null;
}

function policyOf(row: Record<string, unknown>): ProcessingPolicy | null {
  if (row.policy_available !== true) return null;
  const terms = document(row, "terms");
  const privacy = document(row, "privacy");
  const aiNotice = document(row, "ai_notice");
  const agreementCopy = str(row.agreement_copy);
  const agreementCopySha256 = str(row.agreement_copy_sha256);
  const countries = Array.isArray(row.allowed_countries)
    ? row.allowed_countries.filter((c): c is string => typeof c === "string")
    : [];
  const minimumAge = typeof row.minimum_age === "number" ? row.minimum_age : 0;
  if (
    !terms || !privacy || !aiNotice ||
    !agreementCopy || !agreementCopySha256 ||
    countries.length === 0 || minimumAge <= 0
  ) {
    return null;
  }
  return {
    policyId: str(row.policy_id),
    policyVersion: str(row.policy_version),
    terms,
    privacy,
    aiNotice,
    agreementCopy,
    agreementCopySha256,
    allowedCountries: countries,
    minimumAge,
    aiNoticeRendered: row.ai_notice_rendered === true,
  };
}

function headers(): Record<string, string> {
  const token = readGuestOwnerToken();
  return token ? { [GUEST_OWNER_HEADER]: token } : {};
}

export async function fetchAuthorization(): Promise<AuthorizationStatus> {
  let row: Record<string, unknown> | null;
  try {
    const response = await fetch("/api/v2/processing-authorization", {
      method: "GET",
      headers: headers(),
      cache: "no-store",
    });
    row = asRecord(await response.json().catch(() => null));
  } catch {
    return { kind: "error", message: "The agreement could not be loaded." };
  }
  if (!row) return { kind: "error", message: "The agreement could not be loaded." };

  const code = str(row.code) || "PROCESSING_POLICY_INACTIVE";
  const policy = policyOf(row);
  if (!policy) return { kind: "unavailable", code };
  return row.authorized === true
    ? { kind: "authorized", policy }
    : { kind: "acceptance_required", policy, code };
}

export interface AcceptanceInput {
  policy: ProcessingPolicy;
  /** Lowercase code chosen from `policy.allowedCountries`. */
  countryOfResidence: string;
  locale: string;
  clientVersion: string;
  /** One key per ACCEPTANCE ATTEMPT, held across retries of that attempt.
   *  The RPC stores it per principal and replays the same receipt for a
   *  repeated key, so a double tap creates one receipt — but a NEW attempt
   *  after a stale-policy refetch must carry a NEW key, because it is
   *  agreement to different bytes. */
  idempotencyKey: string;
}

export type AcceptanceResult =
  | { kind: "accepted"; receiptId: string; policyVersion: string }
  /** The policy moved under us. The caller MUST re-fetch and re-present, and
   *  must not resubmit with the hashes it already holds. */
  | { kind: "stale" }
  | { kind: "rejected"; code: string; message: string };

export async function acceptAuthorization(
  input: AcceptanceInput,
): Promise<AcceptanceResult> {
  const { policy } = input;
  const body = {
    policy_version: policy.policyVersion,
    // Sent back EXACTLY as received. Never recomputed — see the header note.
    terms_copy_sha256: policy.terms.sha256,
    privacy_copy_sha256: policy.privacy.sha256,
    ai_notice_copy_sha256: policy.aiNotice.sha256,
    agreement_copy_sha256: policy.agreementCopySha256,
    explicit_action: "agree_and_continue",
    age_18_attested: true,
    country_of_residence: input.countryOfResidence.trim().toLowerCase(),
    locale: input.locale,
    client_version: input.clientVersion,
    idempotency_key: input.idempotencyKey,
  };
  let response: Response;
  let row: Record<string, unknown> | null;
  try {
    response = await fetch("/api/v2/processing-authorization", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers() },
      body: JSON.stringify(body),
    });
    row = asRecord(await response.json().catch(() => null));
  } catch {
    return {
      kind: "rejected",
      code: "NETWORK",
      message: "The agreement could not be sent. Check your connection.",
    };
  }
  const code = str(row?.code);
  if (code === "PROCESSING_POLICY_STALE") return { kind: "stale" };
  if (response.ok && row?.authorized === true) {
    return {
      kind: "accepted",
      receiptId: str(row.receipt_id),
      policyVersion: str(row.policy_version) || policy.policyVersion,
    };
  }
  return {
    kind: "rejected",
    code: code || "PROCESSING_AUTHORIZATION_FAILED",
    message: str(row?.error) || "The agreement could not be recorded.",
  };
}

/** Record that this principal was SHOWN the AI notice.
 *
 *  Article 50(1)/50(5) is about exposure, not about agreement, so this is
 *  written on render rather than on submit — a user who reads the notice and
 *  closes the screen was still informed, and `ai_notice_rendered` must say so.
 *  Best effort by design: a failed receipt must never block the screen the
 *  receipt is evidence of.
 */
export async function recordAiNoticeRendered(input: {
  aiNoticeVersion: string;
  surface: string;
  clientRenderId: string;
  clientVersion: string;
}): Promise<boolean> {
  try {
    const response = await fetch("/api/v2/processing-authorization/ai-rendered", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers() },
      body: JSON.stringify({
        ai_notice_version: input.aiNoticeVersion,
        surface: input.surface,
        client_render_id: input.clientRenderId,
        rendered_at: new Date().toISOString(),
        client_version: input.clientVersion,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
