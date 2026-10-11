import { isCanonicalUuid } from "@/lib/uuid";

/* The Confident Moment summary the Ideal Text read carries (its first-paint
 * markers: which paragraph holds a moment, orange, locked, a coach update),
 * and the owner-edit shape it carries beside it. The bundle's own client —
 * its projection read, mutations, playback and exercise panel, behind
 * NEXT_PUBLIC_CONFIDENT_MOMENT_BUNDLE_V1_ENABLED, off by default — was
 * deleted (founder 2026-10-11, simplification Group 1). */

export const CONFIDENT_MOMENT_SUMMARY_CONTRACT =
  "confident-moment-core-summary-v1" as const;

const SHA256 = /^[0-9a-f]{64}$/;

export interface ConfidentMomentSummaryItem {
  bundleId: string;
  paragraphId: string;
  slideIndex: number;
  blockKey: number;
  markerPresent: true;
  isOrange: boolean;
  isLocked: boolean;
  hasCoachUpdate: boolean;
  hasUnreadCoachUpdate: boolean;
  stateRevision: number;
}

export interface ConfidentMomentSummary {
  contractVersion: typeof CONFIDENT_MOMENT_SUMMARY_CONTRACT;
  documentSnapshotId: string;
  items: ConfidentMomentSummaryItem[];
  summarySha256: string;
}

export interface ConfidentMomentOwnerEdit {
  text: string | null;
  sourceDocumentVersion: number | null;
  userTextRevision: string | null;
  userTextSha256: string | null;
  parts: Array<{
    id: string;
    position: number;
    text: string;
    currentPartRevisionId: string | null;
    locked: boolean;
  }>;
  currentBundleTextUpdateBinding: {
    bindingId: string;
    bundleId: string;
    attachmentId: string;
    sourceDocumentVersion: number;
    resultUserTextRevision: string;
    resultUserTextSha256: string;
    resultPartRevisionId: string;
  } | null;
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function uuid(value: unknown): string | null {
  return isCanonicalUuid(value) ? value : null;
}

function sha(value: unknown): string | null {
  return typeof value === "string" && SHA256.test(value) ? value : null;
}

function integer(value: unknown, minimum = 0): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum
    ? value
    : null;
}

const SUMMARY_KEYS = [
  "contract_version", "document_snapshot_id", "items", "summary_sha256",
] as const;

export function mapConfidentMomentSummary(raw: unknown): ConfidentMomentSummary | null {
  const value = object(raw);
  if (!value || !exactKeys(value, SUMMARY_KEYS) || value.contract_version !== CONFIDENT_MOMENT_SUMMARY_CONTRACT) return null;
  const documentSnapshotId = uuid(value.document_snapshot_id);
  const summarySha256 = sha(value.summary_sha256);
  if (!documentSnapshotId || !summarySha256 || !Array.isArray(value.items)) return null;
  const items: ConfidentMomentSummaryItem[] = [];
  const seen = new Set<string>();
  for (const rawItem of value.items) {
    const item = object(rawItem);
    if (!item || !exactKeys(item, [
      "bundle_id", "paragraph_id", "slide_index", "block_key", "marker_present",
      "is_orange", "is_locked", "has_coach_update", "has_unread_coach_update", "state_revision",
    ])) return null;
    const bundleId = uuid(item.bundle_id);
    const paragraphId = uuid(item.paragraph_id);
    const slideIndex = integer(item.slide_index);
    const blockKey = integer(item.block_key);
    const stateRevision = integer(item.state_revision, 1);
    if (!bundleId || !paragraphId || slideIndex === null || blockKey === null || stateRevision === null || seen.has(bundleId)) return null;
    if (item.marker_present !== true || typeof item.is_orange !== "boolean" || typeof item.is_locked !== "boolean" || typeof item.has_coach_update !== "boolean" || typeof item.has_unread_coach_update !== "boolean") return null;
    if (item.is_locked && !item.is_orange) return null;
    if (item.has_unread_coach_update && !item.has_coach_update) return null;
    seen.add(bundleId);
    items.push({
      bundleId, paragraphId, slideIndex, blockKey, markerPresent: true,
      isOrange: item.is_orange, isLocked: item.is_locked,
      hasCoachUpdate: item.has_coach_update,
      hasUnreadCoachUpdate: item.has_unread_coach_update,
      stateRevision,
    });
  }
  return { contractVersion: CONFIDENT_MOMENT_SUMMARY_CONTRACT, documentSnapshotId, items, summarySha256 };
}
