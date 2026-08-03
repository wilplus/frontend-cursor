import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchBlockVariants,
  fetchIdealTextRevisions,
  hasVariantChoice,
  pickerBlockForParagraph,
  restoreIdealTextRevision,
  selectBlockVariant,
  type VariantBlock,
} from "./blockVariants";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

/* -------------------------------------------------------------------------- */
/*  BLOCK_VARIANTS — the picker contract (BE handoff 2026-08-03).              */
/*                                                                            */
/*  The behaviours that MATTER:                                                */
/*   · 404 is "feature off", a first-class state — never an error.             */
/*   · Served order is preserved verbatim (chronology, not ranking — AC-9).    */
/*   · A null variant_id survives ONLY as the display-only current entry.      */
/*   · Block rows are NEVER dropped (the paragraph zip is positional; a        */
/*     dropped row would misattribute every later block's picker).             */
/*   · select/restore map 404→gone and 409→stale for the silent refetch.       */
/* -------------------------------------------------------------------------- */

let calls: Array<{ url: string; method: string; body: unknown }> = [];

function mockFetch(...responses: Array<{ status: number; body?: unknown }>) {
  calls = [];
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(init.body as string) : null,
      });
      const r = responses[Math.min(i++, responses.length - 1)];
      return {
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        json: async () => r.body ?? null,
      };
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const POOL = {
  arc_id: "arc1",
  head_revision: 4,
  blocks: [
    {
      block_key: 10,
      label: "Core Message",
      take_index: 2,
      variants: [
        {
          variant_id: "v1",
          source: "take",
          take_index: 1,
          text: "take one words",
          is_current: false,
        },
        {
          variant_id: "v2",
          source: "take",
          take_index: 2,
          text: "take two words",
          is_current: true,
        },
        {
          variant_id: "v3",
          source: "user_edit",
          take_index: null,
          text: "my own words",
          is_current: false,
        },
      ],
    },
  ],
};

describe("fetchBlockVariants", () => {
  it("maps the pool and PRESERVES the served (chronological) order", async () => {
    mockFetch({ status: 200, body: POOL });
    const r = await fetchBlockVariants("arc1");
    expect(r.kind).toBe("ready");
    if (r.kind !== "ready") return;
    expect(r.headRevision).toBe(4);
    expect(r.blocks).toHaveLength(1);
    const b = r.blocks[0];
    expect(b.blockKey).toBe(10);
    expect(b.label).toBe("Core Message");
    // Order verbatim: takes by take order, the student's edit last. Nothing
    // may re-sort this — chronology is a fence, not a style note (AC-9).
    expect(b.variants.map((v) => v.variantId)).toEqual(["v1", "v2", "v3"]);
    expect(b.variants[1].isCurrent).toBe(true);
    expect(b.variants[2].source).toBe("user_edit");
    expect(b.variants[2].takeIndex).toBeNull();
  });

  it("treats 404 as the feature being OFF, not an error", async () => {
    mockFetch({ status: 404 });
    expect(await fetchBlockVariants("arc1")).toEqual({ kind: "off" });
  });

  it("reports a 500 as an error (the caller keeps its previous pool)", async () => {
    mockFetch({ status: 500, body: { code: "V2_ERROR" } });
    expect(await fetchBlockVariants("arc1")).toEqual({ kind: "error" });
  });

  it("keeps a null-variant_id entry ONLY as the display-only current", async () => {
    mockFetch({
      status: 200,
      body: {
        head_revision: null,
        blocks: [
          {
            block_key: 0,
            label: null,
            take_index: null,
            variants: [
              // Pre-pool incumbent: IS the current text — kept, not selectable.
              { variant_id: null, source: "take", take_index: 1, text: "live", is_current: true },
              // A null-id NON-current entry is nothing honest — dropped.
              { variant_id: null, source: "take", take_index: 2, text: "ghost", is_current: false },
            ],
          },
        ],
      },
    });
    const r = await fetchBlockVariants("arc1");
    if (r.kind !== "ready") throw new Error("expected ready");
    expect(r.blocks[0].variants).toHaveLength(1);
    expect(r.blocks[0].variants[0]).toMatchObject({
      variantId: null,
      isCurrent: true,
    });
  });

  it("drops unusable VARIANT rows but never a BLOCK row (positional zip)", async () => {
    mockFetch({
      status: 200,
      body: {
        head_revision: 1,
        blocks: [
          { block_key: 0, variants: [{ variant_id: "a", source: "take", text: "", is_current: false }] },
          { not_a_block: true },
          POOL.blocks[0],
        ],
      },
    });
    const r = await fetchBlockVariants("arc1");
    if (r.kind !== "ready") throw new Error("expected ready");
    // Three served rows → three mapped rows: alignment with the document's
    // paragraphs survives even when a row is unusable.
    expect(r.blocks).toHaveLength(3);
    expect(r.blocks[0].variants).toHaveLength(0); // empty text dropped
    expect(r.blocks[1].blockKey).toBeNull(); // broken row kept, inert
    expect(r.blocks[2].variants).toHaveLength(3);
  });
});

describe("hasVariantChoice / pickerBlockForParagraph", () => {
  const block = (over: Partial<VariantBlock>): VariantBlock => ({
    blockKey: 10,
    label: null,
    takeIndex: 1,
    variants: [],
    ...over,
  });

  it("offers no affordance for a single-entry list (just the current)", () => {
    const b = block({
      variants: [
        { variantId: "v1", source: "take", takeIndex: 1, text: "t", isCurrent: true },
      ],
    });
    expect(hasVariantChoice(b)).toBe(false);
  });

  it("offers no affordance when the only alternative is un-selectable", () => {
    const b = block({
      variants: [
        { variantId: null, source: "take", takeIndex: 1, text: "t", isCurrent: true },
      ],
    });
    expect(hasVariantChoice(b)).toBe(false);
  });

  it("offers the picker once a selectable non-current variant exists", () => {
    const b = block({
      variants: [
        { variantId: null, source: "take", takeIndex: 1, text: "t", isCurrent: true },
        { variantId: "v2", source: "take", takeIndex: 2, text: "u", isCurrent: false },
      ],
    });
    expect(hasVariantChoice(b)).toBe(true);
  });

  it("zips blocks to paragraphs 1:1 and hides EVERY chip on a mismatch", () => {
    const b = block({
      variants: [
        { variantId: "v1", source: "take", takeIndex: 1, text: "t", isCurrent: true },
        { variantId: "v2", source: "take", takeIndex: 2, text: "u", isCurrent: false },
      ],
    });
    expect(pickerBlockForParagraph([b], 1, 0)).toBe(b);
    // A user edit reshaped the paragraphs → counts mismatch → no chip may
    // render (a misattributed picker would swap the WRONG block).
    expect(pickerBlockForParagraph([b], 2, 0)).toBeNull();
    expect(pickerBlockForParagraph(null, 1, 0)).toBeNull();
  });
});

describe("selectBlockVariant", () => {
  it("POSTs the variant id to the block's select endpoint", async () => {
    mockFetch({ status: 200, body: { saved: true } });
    const r = await selectBlockVariant("arc1", 10, "v1");
    expect(r).toEqual({ kind: "ok" });
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toContain("/blocks/10/select");
    expect(calls[0].body).toEqual({ variant_id: "v1" });
  });

  it("maps 404 → gone and 409 → stale (silent picker refetch, no toast)", async () => {
    mockFetch({ status: 404, body: { code: "NOT_FOUND" } });
    expect(await selectBlockVariant("arc1", 10, "v1")).toEqual({ kind: "gone" });
    mockFetch({ status: 409, body: { code: "NOT_PENDING" } });
    expect(await selectBlockVariant("arc1", 10, "v1")).toEqual({ kind: "stale" });
  });
});

describe("fetchIdealTextRevisions", () => {
  it("maps the timeline newest-first as served, raw reason validated", async () => {
    mockFetch({
      status: 200,
      body: {
        arc_id: "arc1",
        head_revision: 4,
        revisions: [
          { revision: 4, reason: "select", created_at: "2026-08-03T10:00:00Z", is_head: true },
          { revision: 3, reason: "restore", created_at: "2026-08-02T10:00:00Z", is_head: false },
          // Outside the closed enum → the neutral degrade, NEVER the raw token.
          { revision: 2, reason: "mystery_op", created_at: null, is_head: false },
          // No revision number = no restore key → dropped, never repaired.
          { reason: "seed", created_at: "2026-08-01T10:00:00Z", is_head: false },
        ],
      },
    });
    const r = await fetchIdealTextRevisions("arc1");
    if (r.kind !== "ready") throw new Error("expected ready");
    expect(r.headRevision).toBe(4);
    expect(r.revisions.map((x) => x.revision)).toEqual([4, 3, 2]);
    expect(r.revisions[0]).toMatchObject({ reason: "select", isHead: true });
    expect(r.revisions[2].reason).toBe("unknown");
  });

  it("serves an EMPTY list as ready (a real state — the timeline hides)", async () => {
    mockFetch({
      status: 200,
      body: { arc_id: "arc1", head_revision: null, revisions: [] },
    });
    const r = await fetchIdealTextRevisions("arc1");
    expect(r).toEqual({ kind: "ready", headRevision: null, revisions: [] });
  });

  it("treats 404 as OFF", async () => {
    mockFetch({ status: 404 });
    expect(await fetchIdealTextRevisions("arc1")).toEqual({ kind: "off" });
  });
});

describe("restoreIdealTextRevision", () => {
  it("POSTs the restore and returns the NEW head (restore is history too)", async () => {
    mockFetch({ status: 200, body: { restored: true, head_revision: 5 } });
    const r = await restoreIdealTextRevision("arc1", 1);
    expect(r).toEqual({ kind: "ok", headRevision: 5 });
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toContain("/ideal-text/revisions/1/restore");
  });

  it("maps 404 → gone (flag off / revision unknown → silent refetch)", async () => {
    mockFetch({ status: 404, body: { code: "NOT_FOUND" } });
    expect(await restoreIdealTextRevision("arc1", 9)).toEqual({ kind: "gone" });
  });
});
