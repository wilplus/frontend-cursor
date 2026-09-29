/**
 * Rings — the one rollout mechanism (the backend rings migration, founder 2026-09-29).
 *
 * The backend decides, per person, which gated features are on:
 *
 *   A feature is on for a person when the row is not killed, the person's
 *   ring is >= the feature's ring, the row's attribute rule matches them,
 *   and, for a feature with a consent purpose, that consent is current.
 *
 * The browser reads that decision once per page load from
 * `GET /api/v2/user/rings` (`features_on`, `pending_announcements`) and
 * never decides it itself. The four `NEXT_PUBLIC_*` feature flags stay as
 * BUILDING switches (does this build carry the code?); whether THIS person
 * gets the feature comes from `features_on`. A missing or failed read is
 * "nothing on, nothing pending": the F1 loop is never behind a ring, so a
 * closed door here hides an overlay lane and nothing else.
 *
 * Rings decide reach, never provenance (L3): `recordAnnouncementDecision`
 * records an answer to the announcement sheet and creates no consent; the
 * consent itself is recorded by the consent screens, and the feature turns
 * on only when the backend sees it.
 */

export const RING_FEATURES = {
  exerciseService: "exercise_service",
  exerciseServiceUi: "exercise_service_ui",
  coachInlineAuthoring: "coach_inline_authoring",
  confidentMomentBundles: "confident_moment_bundles",
  rootingCoverage: "rooting_coverage",
  canonicalTakeRows: "canonical_take_rows",
  confidenceLearningWrites: "confidence_learning_writes",
} as const;

export type RingFeature = (typeof RING_FEATURES)[keyof typeof RING_FEATURES] | string;

export type ConsentPurpose = "personalised_practice" | "pooled_model_improvement";

export interface PendingAnnouncement {
  feature: string;
  /** Founder-held copy. Ships as "[founder copy] …" placeholders. */
  title: string;
  body: string;
  requires_consent: boolean;
  consent_purpose: ConsentPurpose | null;
  /** Whether the legal policy behind the purpose exists yet; the "yes" for a
   *  Phase-2 purpose stays disabled while this is false. */
  consent_policy_available: boolean | null;
  announced_at: string | null;
}

export interface RingState {
  ring: number | null;
  defaultRing: number | null;
  hasRingRow: boolean;
  attributes: Record<string, unknown>;
  featuresOn: ReadonlySet<string>;
  pendingAnnouncements: PendingAnnouncement[];
  /** The read failed or the person has no principal: nothing on, nothing pending. */
  unavailable: boolean;
}

export const EMPTY_RING_STATE: RingState = {
  ring: null,
  defaultRing: null,
  hasRingRow: false,
  attributes: {},
  featuresOn: new Set<string>(),
  pendingAnnouncements: [],
  unavailable: true,
};

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function announcement(raw: unknown): PendingAnnouncement | null {
  const row = object(raw);
  const feature = row ? text(row.feature) : null;
  if (!row || !feature) return null;
  const purpose = text(row.consent_purpose);
  return {
    feature,
    title: text(row.title) ?? "",
    body: text(row.body) ?? "",
    requires_consent: row.requires_consent === true,
    consent_purpose:
      purpose === "personalised_practice" || purpose === "pooled_model_improvement"
        ? purpose
        : null,
    consent_policy_available:
      typeof row.consent_policy_available === "boolean" ? row.consent_policy_available : null,
    announced_at: text(row.announced_at),
  };
}

/** Pure: the payload of `GET /v2/user/rings`, or anything else → the empty state. */
export function mapRingState(raw: unknown): RingState {
  const row = object(raw);
  if (!row) return EMPTY_RING_STATE;
  const featuresOn = new Set<string>();
  if (Array.isArray(row.features_on)) {
    for (const item of row.features_on) if (typeof item === "string") featuresOn.add(item);
  }
  const pending = Array.isArray(row.pending_announcements)
    ? row.pending_announcements.map(announcement).filter((a): a is PendingAnnouncement => a !== null)
    : [];
  return {
    ring: integer(row.ring),
    defaultRing: integer(row.default_ring),
    hasRingRow: row.has_ring_row === true,
    attributes: object(row.attributes) ?? {},
    featuresOn,
    pendingAnnouncements: pending,
    unavailable: row.unavailable === true,
  };
}

/** Pure: is this feature on for the person the state describes? */
export function featureIsOn(state: RingState | null | undefined, feature: RingFeature): boolean {
  return Boolean(state && !state.unavailable && state.featuresOn.has(feature));
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** One read of the person's ring state. Never throws. */
export async function fetchRingState(): Promise<RingState> {
  try {
    const response = await fetch("/api/v2/user/rings", { cache: "no-store" });
    if (!response.ok) return EMPTY_RING_STATE;
    return mapRingState(await readJson(response));
  } catch {
    return EMPTY_RING_STATE;
  }
}

export type AnnouncementDecision = "accepted" | "not_now";

/** The person's answer to an announcement. Records an answer, never a consent. */
export async function recordAnnouncementDecision(
  feature: string,
  decision: AnnouncementDecision
): Promise<boolean> {
  try {
    const response = await fetch(
      `/api/v2/user/rings/announcements/${encodeURIComponent(feature)}/decision`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*  One shared read per page load. Components call `useRingState()`; the       */
/*  first caller fetches, everyone else shares the promise, and a decision      */
/*  or a panel edit calls `refreshRingState()` to read again.                  */
/* -------------------------------------------------------------------------- */

type Listener = (state: RingState) => void;

let cached: RingState | null = null;
let inflight: Promise<RingState> | null = null;
const listeners = new Set<Listener>();

function publish(state: RingState) {
  cached = state;
  for (const listener of listeners) listener(state);
}

export function loadRingState(): Promise<RingState> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetchRingState().then((state) => {
      inflight = null;
      publish(state);
      return state;
    });
  }
  return inflight;
}

export function refreshRingState(): Promise<RingState> {
  cached = null;
  return loadRingState();
}

/** For tests: forget the shared read. */
export function resetRingStateCache(): void {
  cached = null;
  inflight = null;
  listeners.clear();
}

export function subscribeRingState(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentRingState(): RingState | null {
  return cached;
}
