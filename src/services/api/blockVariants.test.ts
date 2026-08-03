import { describe, expect, it } from "vitest";

import {
  blockHasChoice,
  mapBlockVariantsPayload,
  mapIdealRevisions,
  type VariantBlock,
} from "./blockVariants";
import { VARIANT_PICKER_COPY } from "@/components/willab/variantPickerCopy";

/* -------------------------------------------------------------------------- */
/*  blockVariants mappers — the wire tolerance the picker stands on (BE spec   */
/*  FE-HANDOFF-2026-08-03-variant-picker §4/§9), plus the AC-9 pin: nothing    */
/*  in the mapped shapes carries a score or rank, and the picker-affordance    */
/*  predicate keys on real CHOICE, never on quality.                           */
/* -------------------------------------------------------------------------- */

const wireVariant = (over: Record<string, unknown> = {}) => ({
  variant_id: "v1",
  source: "take",
  take_index: 1,
  text: "the words",
  is_current: false,
  ...over,
});

describe("mapBlockVariantsPayload", () => {
  it("maps the spec shape, order preserved (chronological, never ranked)", () => {
    const payload = mapBlockVariantsPayload({
      head_revision: 4,
      blocks: [
        {
          block_key: 10,
          label: "Core Message",
          take_index: 2,
          variants: [
            wireVariant(),
            wireVariant({ variant_id: "v2", take_index: 2, is_current: true }),
            wireVariant({
              variant_id: "v3",
              source: "user_edit",
              take_index: null,
              text: "my edit",
            }),
          ],
        },
      ],
    });
    expect(payload.headRevision).toBe(4);
    expect(payload.blocks).toHaveLength(1);
    const [b] = payload.blocks;
    expect(b.blockKey).toBe(10);
    expect(b.label).toBe("Core Message");
    expect(b.variants.map((v) => v.variantId)).toEqual(["v1", "v2", "v3"]);
    expect(b.variants[1].isCurrent).toBe(true);
    expect(b.variants[2].source).toBe("user_edit");
    expect(b.variants[2].takeIndex).toBeNull();
  });

  it("keeps the pre-pool incumbent (variant_id null) — display-only current", () => {
    const payload = mapBlockVariantsPayload({
      blocks: [
        {
          block_key: 0,
          variants: [
            wireVariant({ variant_id: null, is_current: true }),
          ],
        },
      ],
    });
    const [v] = payload.blocks[0].variants;
    expect(v.variantId).toBeNull();
    expect(v.isCurrent).toBe(true);
  });

  it("drops broken rows, never whole payloads: unknown source, empty text, keyless block", () => {
    const payload = mapBlockVariantsPayload({
      blocks: [
        {
          block_key: 0,
          variants: [
            wireVariant({ source: "ranked_best" }), // unknown → dropped
            wireVariant({ text: "" }), // empty → dropped
            wireVariant({ variant_id: "ok" }),
          ],
        },
        { label: "no key", variants: [wireVariant()] }, // keyless → dropped
        "garbage",
      ],
    });
    expect(payload.blocks).toHaveLength(1);
    expect(payload.blocks[0].variants.map((v) => v.variantId)).toEqual(["ok"]);
  });

  it("maps a broken root to ready-with-empty (the GET answered)", () => {
    expect(mapBlockVariantsPayload(null)).toEqual({
      blocks: [],
      headRevision: null,
    });
  });

  it("AC-9 — the mapped shapes carry provenance and text only, no score keys", () => {
    const payload = mapBlockVariantsPayload({
      blocks: [{ block_key: 0, variants: [wireVariant()] }],
    });
    const walk = (x: unknown): void => {
      if (Array.isArray(x)) return x.forEach(walk);
      if (x && typeof x === "object") {
        for (const [k, v] of Object.entries(x)) {
          expect(k.toLowerCase()).not.toContain("score");
          expect(k.toLowerCase()).not.toContain("rank");
          expect(k.toLowerCase()).not.toContain("why");
          walk(v);
        }
      }
    };
    walk(payload);
  });
});

describe("blockHasChoice — the affordance predicate (spec §8.3)", () => {
  const block = (variants: VariantBlock["variants"]): VariantBlock => ({
    blockKey: 0,
    label: null,
    takeIndex: 1,
    variants,
  });
  const v = (over: Partial<VariantBlock["variants"][0]> = {}) => ({
    variantId: "v1" as string | null,
    source: "take" as const,
    takeIndex: 1,
    text: "words",
    isCurrent: false,
    ...over,
  });

  it("two entries with a selectable non-current → choice", () => {
    expect(
      blockHasChoice(block([v({ isCurrent: true }), v({ variantId: "v2" })]))
    ).toBe(true);
  });

  it("a single entry (just the current) → no affordance", () => {
    expect(blockHasChoice(block([v({ isCurrent: true })]))).toBe(false);
  });

  it("a pre-pool current + nothing selectable → no affordance", () => {
    expect(
      blockHasChoice(
        block([v({ variantId: null, isCurrent: true }), v({ variantId: null })])
      )
    ).toBe(false);
  });
});

describe("mapIdealRevisions", () => {
  it("maps rows and clamps reason to the closed enum", () => {
    const { revisions, headRevision } = mapIdealRevisions({
      head_revision: 3,
      revisions: [
        { revision: 3, reason: "select", created_at: "2026-08-03T10:00:00Z", is_head: true },
        { revision: 2, reason: "power_rerank", created_at: null, is_head: false },
        { revision: "x", reason: "seed" }, // broken → dropped
      ],
    });
    expect(headRevision).toBe(3);
    expect(revisions).toHaveLength(2);
    expect(revisions[0].reason).toBe("select");
    expect(revisions[0].isHead).toBe(true);
    // Unknown reason → null → the copy layer's FALLBACK line, never the
    // raw token in a user's face.
    expect(revisions[1].reason).toBeNull();
  });

  it("every closed reason has a copy line (no raw token can ever render)", () => {
    for (const reason of ["seed", "accept", "select", "restore"] as const) {
      expect(VARIANT_PICKER_COPY.reason[reason]).toBeTruthy();
    }
    expect(VARIANT_PICKER_COPY.reason.fallback).toBeTruthy();
  });
});
