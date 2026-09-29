/**
 * The founder's rings panel client (backend /v2/admin/rings/*).
 *
 * Thin fetches over the BFF routes under /api/v2/admin/rings/*. The backend's
 * @require_admin is the gate; the panel only renders behind the founder check
 * on its page. Every write goes to one SECURITY DEFINER RPC upstream; nothing
 * here decides a ring, a kill or a consent. Refusals come back as the RPC's
 * code (RING_ONE_WAY_KILLED and friends) and the panel shows the code.
 */

export interface FeatureCounts {
  reaches: number;
  on: number;
  default_ring_reaches: boolean;
  consent_policy_available: boolean | null;
}

export interface RingAnnouncement {
  feature: string;
  title: string;
  body: string;
  requires_consent: boolean;
  retired_at: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface FeatureRing {
  feature: string;
  min_ring: number;
  attribute_rule: Record<string, string[]> | null;
  consent_purpose: "personalised_practice" | "pooled_model_improvement" | null;
  killed: boolean;
  one_way: boolean;
  note: string;
  changed_by: string | null;
  changed_at: string;
  counts?: FeatureCounts | null;
  announcement?: RingAnnouncement | null;
}

export interface RingPerson {
  user_id: string;
  email: string | null;
  name: string | null;
  principal_id: string | null;
  ring: number;
  has_ring_row: boolean;
  attributes: Record<string, unknown>;
  reaches: { feature: string; consent_purpose: string | null }[];
}

export interface RingChange {
  kind: "feature" | "principal" | "setting";
  id: number;
  changed_by: string | null;
  changed_at: string;
  [key: string]: unknown;
}

export type AdminResult<T> = { ok: true; value: T } | { ok: false; code: string; status: number };

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value = (await response.json()) as unknown;
    return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function call<T>(path: string, init: RequestInit, pick: (body: Record<string, unknown>) => T): Promise<AdminResult<T>> {
  try {
    const response = await fetch(path, { cache: "no-store", ...init });
    const body = await readJson(response);
    if (!response.ok) {
      return { ok: false, code: String(body.code ?? `HTTP_${response.status}`), status: response.status };
    }
    return { ok: true, value: pick(body) };
  } catch {
    return { ok: false, code: "UNREACHABLE", status: 0 };
  }
}

const json = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const adminRings = {
  features: () =>
    call("/api/v2/admin/rings/features", { method: "GET" }, (b) => ({
      features: (Array.isArray(b.features) ? b.features : []) as FeatureRing[],
      defaultRing: typeof b.default_ring === "number" ? b.default_ring : null,
    })),
  setFeature: (feature: string, body: Partial<FeatureRing>) =>
    call(`/api/v2/admin/rings/features/${encodeURIComponent(feature)}`, { method: "PUT", ...json(body) }, (b) => b.feature as FeatureRing),
  kill: (feature: string, killed: boolean) =>
    call(`/api/v2/admin/rings/features/${encodeURIComponent(feature)}/kill`, { method: "POST", ...json({ killed }) }, (b) => b.feature as FeatureRing),
  people: (query: URLSearchParams) =>
    call(`/api/v2/admin/rings/people?${query.toString()}`, { method: "GET" }, (b) => ({
      people: (Array.isArray(b.people) ? b.people : []) as RingPerson[],
      defaultRing: typeof b.default_ring === "number" ? b.default_ring : null,
      hasMore: b.has_more === true,
    })),
  setPerson: (principalId: string, body: { ring?: number; attributes?: Record<string, unknown> }) =>
    call(`/api/v2/admin/rings/people/${encodeURIComponent(principalId)}`, { method: "PUT", ...json(body) }, (b) => b.person),
  bulk: (principalIds: string[], ring: number) =>
    call("/api/v2/admin/rings/people/bulk", { method: "POST", ...json({ principal_ids: principalIds, ring }) }, (b) => Number(b.moved ?? 0)),
  getDefault: () =>
    call("/api/v2/admin/rings/default", { method: "GET" }, (b) => ({
      defaultRing: typeof b.default_ring === "number" ? b.default_ring : null,
      attributeKeys: (Array.isArray(b.attribute_keys) ? b.attribute_keys : []) as string[],
    })),
  setDefault: (ring: number) =>
    call("/api/v2/admin/rings/default", { method: "PUT", ...json({ ring }) }, (b) => Number(b.default_ring)),
  me: () =>
    call("/api/v2/admin/rings/me", { method: "GET" }, (b) => ({
      principalId: typeof b.principal_id === "string" ? b.principal_id : null,
      ring: typeof b.ring === "number" ? b.ring : null,
      featuresOn: (Array.isArray(b.features_on) ? b.features_on : []) as string[],
      attributes: (b.attributes ?? {}) as Record<string, unknown>,
    })),
  announcements: () =>
    call("/api/v2/admin/rings/announcements", { method: "GET" }, (b) =>
      (Array.isArray(b.announcements) ? b.announcements : []) as RingAnnouncement[]),
  setAnnouncement: (feature: string, body: { title: string; body: string; requires_consent: boolean; retired?: boolean }) =>
    call(`/api/v2/admin/rings/announcements/${encodeURIComponent(feature)}`, { method: "PUT", ...json(body) }, (b) => b.announcement as RingAnnouncement),
  audit: (limit = 200) =>
    call(`/api/v2/admin/rings/audit?limit=${limit}`, { method: "GET" }, (b) =>
      (Array.isArray(b.changes) ? b.changes : []) as RingChange[]),
};

/** The attribute rule editor's text ↔ object. Rules are an AND of "key is in list". */
export function parseRule(text: string): { rule: Record<string, string[]> | null; error: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { rule: null, error: null };
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { rule: null, error: "rule must be an object of lists" };
    }
    const rule: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) return { rule: null, error: `"${key}" must be a list` };
      rule[key] = value.map((item) => String(item));
    }
    return { rule, error: null };
  } catch {
    return { rule: null, error: "rule is not valid JSON" };
  }
}
