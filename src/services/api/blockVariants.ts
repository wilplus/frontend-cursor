import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  blockVariants — the block variant PICKER, revisions & restore              */
/*  (BLOCK_VARIANTS_ENABLED, BE handoff 2026-08-03)                            */
/*                                                                            */
/*  The backend keeps an APPEND-ONLY pool of every text each block has ever    */
/*  had — every take's version (verbatim, take-badged) plus the student's      */
/*  latest edit — and records "my text" as a composition with append-only      */
/*  revisions and a head. Nothing is ever overwritten; select and restore      */
/*  only repoint.                                                             */
/*                                                                            */
/*  Feature detection: the variants GET 404s while the flag is down (or on a   */
/*  pre-migration arc). 404 = "render nothing new", a first-class state.       */
/*                                                                            */
/*  AC-9 (load-bearing): variant order is CHRONOLOGICAL, never quality — the   */
/*  mappers preserve the served order and nothing here may sort or rank.       */
/*  take_index is provenance for the existing badge convention, never a        */
/*  score. head_revision / revision are plumbing: used, never featured.        */
/* -------------------------------------------------------------------------- */

/** One candidate text for one block. `variantId: null` marks a pre-pool
 *  incumbent (arc older than the migration): it IS the current text — render
 *  it, flag it current, never make it selectable (there is nothing to
 *  select). */
export interface BlockVariant {
  variantId: string | null;
  source: "take" | "user_edit";
  /** 1-based take badge; null for a user edit. */
  takeIndex: number | null;
  text: string;
  isCurrent: boolean;
}

/** One block's pool. A row that cannot select (blockKey null on a broken
 *  payload row) is KEPT with empty variants rather than dropped: the picker
 *  affordance zips blocks to paragraphs positionally (the same slot-order
 *  rule as the piece badges), so dropping a row would misattribute every
 *  later block's picker. */
export interface VariantBlock {
  blockKey: number | null;
  /** Render when present ("Core Message"). */
  label: string | null;
  /** The CURRENT incumbent's take badge (int|null). */
  takeIndex: number | null;
  /** Chronological, as served — take variants by take order, then the
   *  student's latest edit last. NEVER re-order (AC-9 fence). */
  variants: BlockVariant[];
}

export type BlockVariantsResult =
  /** The pool, in block order. */
  | { kind: "ready"; headRevision: number | null; blocks: VariantBlock[] }
  /** 404 — flag down or pre-migration arc: render nothing new, no error. */
  | { kind: "off" }
  /** Read failure — the caller keeps whatever it already holds (an empty
   *  picker lies) and the existing retry affordance covers it. */
  | { kind: "error" };

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function intOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Map one variant row. Unusable rows (no text, unknown source) are dropped —
 *  a candidate that cannot render honestly must not occupy the list. A null
 *  variant_id survives ONLY as the display-only current entry. */
function mapVariant(raw: unknown): BlockVariant | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const text = str(r.text);
  const source =
    r.source === "take" || r.source === "user_edit" ? r.source : null;
  if (!text || !source) return null;
  const variantId = str(r.variant_id) || null;
  const isCurrent = r.is_current === true;
  // A null-id entry exists so the list is never missing its own current
  // state; a null-id NON-current entry is neither selectable nor current —
  // nothing it could honestly be. Drop it.
  if (!variantId && !isCurrent) return null;
  return {
    variantId,
    source,
    takeIndex: source === "take" ? intOrNull(r.take_index) : null,
    text,
    isCurrent,
  };
}

function mapBlock(raw: unknown): VariantBlock {
  const r =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    blockKey: intOrNull(r.block_key),
    label: str(r.label) || null,
    takeIndex: intOrNull(r.take_index),
    variants: Array.isArray(r.variants)
      ? r.variants
          .map(mapVariant)
          .filter((v): v is BlockVariant => v !== null)
      : [],
  };
}

/** True when the block offers a real choice: at least one selectable
 *  (id-carrying, non-current) variant on a block we can address. A block
 *  whose list is a single entry — just the current — gets no affordance
 *  (handoff §8.3). Pure. */
export function hasVariantChoice(block: VariantBlock): boolean {
  return (
    block.blockKey !== null &&
    block.variants.some((v) => v.variantId !== null && !v.isCurrent)
  );
}

/** THE KEYED JOIN (backend #318, 2026-08-03 — the answer to the anchoring
 *  handoff): the served `pieces[]` now carry `block_key`, so paragraph i's
 *  chip is the block whose key MATCHES `pieces[i].blockKey`, wherever it
 *  sits in the pool. The earlier "block_key equals piece_key" assumption
 *  was WRONG on any multi-block document — block keys are gapped by design
 *  (0, 10, 20…) while piece keys are paragraph indexes (0, 1, 2…) — so the
 *  old pairwise-equality check failed closed and hid every chip there.
 *
 *  Returns an array ALIGNED TO THE PARAGRAPHS (out[i] = paragraph i's
 *  block); a paragraph whose key finds no block gets a choiceless stub, so
 *  only ITS chip hides — never the whole layer, and never a guessed attach.
 *  Pieces without block_key (older BE payload) fall back to the positional
 *  zip, verified pairwise — unverifiable IS misaligned, chips hide. No
 *  pieces at all (saved/frozen document, legacy lane) → the blocks pass
 *  through for the count-gated positional rule. null = render no chips.
 *  Pure. */
export function alignVariantBlocksWithPieces(
  blocks: VariantBlock[] | null,
  pieces: Array<{ pieceKey: number; blockKey?: number | null }> | null
): VariantBlock[] | null {
  if (!blocks) return null;
  if (!pieces || pieces.length === 0) return blocks;
  if (pieces.every((p) => typeof p.blockKey === "number")) {
    const byKey = new Map(blocks.map((b) => [b.blockKey, b]));
    return pieces.map(
      (p) =>
        byKey.get(p.blockKey as number) ?? {
          blockKey: null,
          label: null,
          takeIndex: null,
          variants: [],
        }
    );
  }
  if (blocks.length !== pieces.length) return null;
  for (let i = 0; i < blocks.length; i++) {
    // A null blockKey cannot be verified against its piece — with the key
    // join available, unverifiable IS misaligned (never a guessed chip).
    if (blocks[i].blockKey === null) return null;
    if (blocks[i].blockKey !== pieces[i].pieceKey) return null;
  }
  return blocks;
}

/** Zip the pool's blocks to the reading view's paragraphs — the SAME
 *  slot-order rule as the piece badges. BE-CONFIRMED (2026-08-03):
 *  `blocks[]` is served in document order and every block contributes
 *  exactly one "\n\n"-joined segment of the served text, so the zip is
 *  exact on the machine lane. Any count mismatch (a user edit reshaped
 *  paragraphs, a lagging payload) still hides every picker affordance
 *  rather than misattribute one. Returns the block for paragraph `i`,
 *  already gated on it offering a real choice. Pure. */
export function pickerBlockForParagraph(
  blocks: VariantBlock[] | null,
  paragraphCount: number,
  i: number
): VariantBlock | null {
  if (!blocks || blocks.length !== paragraphCount) return null;
  const b = blocks[i];
  return b && hasVariantChoice(b) ? b : null;
}

/** The picker read. 404 = feature off; anything else unusable = error (the
 *  caller keeps its previous pool — append-only means every id in it stays
 *  valid). */
export async function fetchBlockVariants(
  arcId: string
): Promise<BlockVariantsResult> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/blocks/variants`,
      { headers, credentials: "include", cache: "no-store" }
    );
  } catch {
    return { kind: "error" };
  }
  if (res.status === 404) return { kind: "off" };
  if (!res.ok) return { kind: "error" };
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || !Array.isArray(body.blocks)) return { kind: "error" };
  return {
    kind: "ready",
    headRevision: intOrNull(body.head_revision),
    blocks: body.blocks.map(mapBlock),
  };
}

export type SelectVariantResult =
  /** The block flipped (or was already this variant — idempotent 200). */
  | { kind: "ok" }
  /** 404 — flag off / block or variant gone: the pool changed under us.
   *  Refetch the picker silently, never an error toast (handoff §9). */
  | { kind: "gone" }
  /** 409 NOT_PENDING — unreachable through the picker payload (candidates
   *  are excluded from the read); handle by refetching. */
  | { kind: "stale" }
  | { kind: "error" };

/** Select one variant for one block (mix & match). Non-destructive always:
 *  the displaced text goes back to the pool BE-side, so callers build zero
 *  confirmation-of-loss language around this. Silent by design — no bubble
 *  fires; the caller refetches (§5 order). */
export async function selectBlockVariant(
  arcId: string,
  blockKey: number,
  variantId: string
): Promise<SelectVariantResult> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(
        arcId
      )}/blocks/${encodeURIComponent(String(blockKey))}/select`,
      {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ variant_id: variantId }),
      }
    );
  } catch {
    return { kind: "error" };
  }
  if (res.status === 404) return { kind: "gone" };
  if (res.status === 409) return { kind: "stale" };
  if (!res.ok) return { kind: "error" };
  return { kind: "ok" };
}

/* ------------------------------ the timeline ------------------------------ */

/** The closed reason vocabulary. "unknown" is the FE's own degrade for a
 *  token outside the enum — it renders neutral fallback copy, NEVER the raw
 *  token, and never invents a specific claim. */
export type RevisionReason = "seed" | "accept" | "select" | "restore" | "unknown";

export interface IdealTextRevision {
  revision: number;
  reason: RevisionReason;
  createdAt: string | null;
  isHead: boolean;
}

export type RevisionsResult =
  | { kind: "ready"; headRevision: number | null; revisions: IdealTextRevision[] }
  | { kind: "off" }
  | { kind: "error" };

/** The revision timeline, newest first as served. An EMPTY list is a real
 *  state (pre-migration arc): the caller hides the timeline entirely. */
export async function fetchIdealTextRevisions(
  arcId: string
): Promise<RevisionsResult> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/ideal-text/revisions`,
      { headers, credentials: "include", cache: "no-store" }
    );
  } catch {
    return { kind: "error" };
  }
  if (res.status === 404) return { kind: "off" };
  if (!res.ok) return { kind: "error" };
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || !Array.isArray(body.revisions)) return { kind: "error" };
  const revisions: IdealTextRevision[] = [];
  for (const item of body.revisions) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    // The revision number is the restore key — a row without one offers a
    // restore that can never succeed, so it is dropped, never repaired.
    const revision = intOrNull(r.revision);
    if (revision === null) continue;
    revisions.push({
      revision,
      reason:
        r.reason === "seed" ||
        r.reason === "accept" ||
        r.reason === "select" ||
        r.reason === "restore"
          ? r.reason
          : "unknown",
      createdAt: str(r.created_at) || null,
      isHead: r.is_head === true,
    });
  }
  return {
    kind: "ready",
    headRevision: intOrNull(body.head_revision),
    revisions,
  };
}

export type RestoreResult =
  /** Restored; the head is a NEW revision (restore is itself history and is
   *  itself undoable). */
  | { kind: "ok"; headRevision: number | null }
  /** 404 — flag off / revision unknown: refetch silently. */
  | { kind: "gone" }
  | { kind: "error" };

/** Repoint the head at what `revision` recorded. Restore never deletes —
 *  blocks added to the document after that revision stay as they are. */
export async function restoreIdealTextRevision(
  arcId: string,
  revision: number
): Promise<RestoreResult> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(
        arcId
      )}/ideal-text/revisions/${encodeURIComponent(String(revision))}/restore`,
      { method: "POST", headers, credentials: "include" }
    );
  } catch {
    return { kind: "error" };
  }
  if (res.status === 404) return { kind: "gone" };
  if (!res.ok) return { kind: "error" };
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  return { kind: "ok", headRevision: intOrNull(body?.head_revision) };
}
