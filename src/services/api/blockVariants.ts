import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  blockVariants — the VARIANT POOL surfaces (BE spec:                        */
/*  docs/FE-HANDOFF-2026-08-03-variant-picker.md, backend-cursor).             */
/*                                                                            */
/*  Four flag-gated endpoints behind BLOCK_VARIANTS_ENABLED:                   */
/*    GET  …/blocks/variants                → the per-block picker read        */
/*    POST …/blocks/<block_key>/select      → point a block at ANY variant     */
/*    GET  …/ideal-text/revisions           → the composition timeline         */
/*    POST …/ideal-text/revisions/<r>/restore → repoint at an earlier one      */
/*                                                                            */
/*  FEATURE DETECTION (spec §3): 404 on the GET means the feature is OFF —     */
/*  a first-class state ({kind:"off"}), never an error surface.                */
/*                                                                            */
/*  AC-9: the payload is provenance + text only. Variant order is             */
/*  CHRONOLOGICAL and must never be presented as ranked (spec §6).            */
/* -------------------------------------------------------------------------- */

export interface BlockVariant {
  /** null = the pre-pool incumbent (spec §4.1): it IS the current text —
   *  render it, flag it current, never selectable. */
  variantId: string | null;
  source: "take" | "user_edit";
  /** Provenance badge only (1-based take). null for user_edit variants. */
  takeIndex: number | null;
  text: string;
  isCurrent: boolean;
}

export interface VariantBlock {
  blockKey: number;
  label: string | null;
  /** The CURRENT incumbent's take badge (null = user-edited/pre-index). */
  takeIndex: number | null;
  variants: BlockVariant[];
}

export interface BlockVariantsPayload {
  blocks: VariantBlock[];
  headRevision: number | null;
}

export type BlockVariantsResult =
  | { kind: "ready"; payload: BlockVariantsPayload }
  /** 404 — flag off / lane not deployed. Render nothing new (spec §3). */
  | { kind: "off" }
  | { kind: "error" };

export interface IdealRevision {
  revision: number;
  reason: "seed" | "accept" | "select" | "restore" | null;
  createdAt: string | null;
  isHead: boolean;
}

export type IdealRevisionsResult =
  | { kind: "ready"; revisions: IdealRevision[]; headRevision: number | null }
  | { kind: "off" }
  | { kind: "error" };

export type VariantWriteResult =
  /** Saved — refetch the document, the picker, and (if open) the timeline
   *  in that order (spec §5). */
  | { kind: "ok" }
  /** 404/409 after a fresh GET — the state moved under us. Refetch
   *  silently, never an error surface (spec §9). */
  | { kind: "stale" }
  | { kind: "error" };

const str = (v: unknown): string => (typeof v === "string" ? v : "");

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && !Number.isNaN(v) ? v : null;

/** Map the picker GET. Tolerant in the house style (mapIdealPieces): a
 *  broken row is dropped, an unknown source drops the ROW (a badge we
 *  cannot name honestly must not render), a broken payload maps to
 *  ready-with-empty rather than error (the GET answered). Pure. */
export function mapBlockVariantsPayload(raw: unknown): BlockVariantsPayload {
  const root =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const blocks: VariantBlock[] = [];
  const rawBlocks = Array.isArray(root.blocks) ? root.blocks : [];
  for (const item of rawBlocks) {
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, unknown>;
    const blockKey = num(b.block_key);
    if (blockKey === null) continue;
    const variants: BlockVariant[] = [];
    for (const v of Array.isArray(b.variants) ? b.variants : []) {
      if (!v || typeof v === "boolean") continue;
      const r = v as Record<string, unknown>;
      const source =
        r.source === "take" || r.source === "user_edit" ? r.source : null;
      const text = str(r.text);
      if (!source || !text) continue;
      variants.push({
        variantId: str(r.variant_id) || null,
        source,
        takeIndex: num(r.take_index),
        text,
        isCurrent: r.is_current === true,
      });
    }
    blocks.push({
      blockKey,
      label: str(b.label) || null,
      takeIndex: num(b.take_index),
      variants,
    });
  }
  return { blocks, headRevision: num(root.head_revision) };
}

/** Map the revisions GET. Unknown reason → null (the copy layer renders
 *  its fallback line, never the raw token). Pure. */
export function mapIdealRevisions(raw: unknown): {
  revisions: IdealRevision[];
  headRevision: number | null;
} {
  const root =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: IdealRevision[] = [];
  for (const item of Array.isArray(root.revisions) ? root.revisions : []) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const revision = num(r.revision);
    if (revision === null) continue;
    const reason =
      r.reason === "seed" ||
      r.reason === "accept" ||
      r.reason === "select" ||
      r.reason === "restore"
        ? r.reason
        : null;
    out.push({
      revision,
      reason,
      createdAt: str(r.created_at) || null,
      isHead: r.is_head === true,
    });
  }
  return { revisions: out, headRevision: num(root.head_revision) };
}

/** Which variants a block can actually OFFER as a choice: everything
 *  selectable (has an id) plus the current one. The picker affordance
 *  shows only when there is a real choice — 2+ entries with at least one
 *  selectable non-current (spec §8.3). Pure. */
export function blockHasChoice(block: VariantBlock): boolean {
  return (
    block.variants.length >= 2 &&
    block.variants.some((v) => v.variantId !== null && !v.isCurrent)
  );
}

async function authedFetch(
  path: string,
  init?: RequestInit
): Promise<Response | null> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(path, { ...init, headers, credentials: "include" });
  } catch {
    return null;
  }
}

export async function fetchBlockVariants(
  arcId: string
): Promise<BlockVariantsResult> {
  const res = await authedFetch(
    `/api/v2/explore/arc/${encodeURIComponent(arcId)}/blocks/variants`,
    { cache: "no-store" }
  );
  if (!res) return { kind: "error" };
  if (res.status === 404) return { kind: "off" };
  if (!res.ok) return { kind: "error" };
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { kind: "error" };
  }
  return { kind: "ready", payload: mapBlockVariantsPayload(body) };
}

export async function selectBlockVariant(
  arcId: string,
  blockKey: number,
  variantId: string
): Promise<VariantWriteResult> {
  const res = await authedFetch(
    `/api/v2/explore/arc/${encodeURIComponent(
      arcId
    )}/blocks/${encodeURIComponent(String(blockKey))}/select`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variant_id: variantId }),
    }
  );
  if (!res) return { kind: "error" };
  if (res.status === 404 || res.status === 409) return { kind: "stale" };
  if (!res.ok) return { kind: "error" };
  return { kind: "ok" };
}

export async function fetchIdealRevisions(
  arcId: string
): Promise<IdealRevisionsResult> {
  const res = await authedFetch(
    `/api/v2/explore/arc/${encodeURIComponent(arcId)}/ideal-text/revisions`,
    { cache: "no-store" }
  );
  if (!res) return { kind: "error" };
  if (res.status === 404) return { kind: "off" };
  if (!res.ok) return { kind: "error" };
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { kind: "error" };
  }
  return { kind: "ready", ...mapIdealRevisions(body) };
}

export async function restoreIdealRevision(
  arcId: string,
  revision: number
): Promise<VariantWriteResult> {
  const res = await authedFetch(
    `/api/v2/explore/arc/${encodeURIComponent(
      arcId
    )}/ideal-text/revisions/${encodeURIComponent(String(revision))}/restore`,
    { method: "POST", headers: { "Content-Type": "application/json" } }
  );
  if (!res) return { kind: "error" };
  if (res.status === 404 || res.status === 409) return { kind: "stale" };
  if (!res.ok) return { kind: "error" };
  return { kind: "ok" };
}
