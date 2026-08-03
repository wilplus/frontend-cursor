# FE → BE — block variant picker: one anchoring assumption to confirm before the flag flips

**Date:** 2026-08-03 · **From:** FE (frontend-cursor) · **Re:** BE handoff 2026-08-03
(`BLOCK_VARIANTS_ENABLED`, picker / revisions / restore) · **Blocks:** the §10 sweep / flag flip
**Three checkboxes, at the bottom. Everything above them is the evidence.**

```
FILTER: JUSTIFIED-SCAFFOLDING — cat {F1-SUPPORT} — fences {clear} — locks {clear}
        — redirect: unblocks the in-flight BLOCK_VARIANTS_ENABLED picker FE (shipped dark)
```

---

## The gap

The handoff never pins how §4.1's `blocks[]` relates to the document the student is reading,
so the FE anchored the per-block picker entry the same way the piece badges are BE-pinned
today:

> **Assumption:** `blocks[]` is served in block order, and the master text is assembled by
> joining exactly those blocks' current texts with `"\n\n"`, in that same order — so
> paragraph *i* of the served `text` ↔ `blocks[i]`, **1:1, on the machine lane**.

## What the FE does with it

1. The picker chip for a block attaches to its paragraph **positionally**
   (`blocks.length === paragraphCount`, slot order) — the same zip rule as `pieces[]`
   (`pickerBlockForParagraph`, `src/services/api/blockVariants.ts`).
2. On **any count mismatch** (user-edited document, lagging payload, a block with
   empty/absent text, anything that reshapes paragraphs), every chip **hides** rather than
   risk opening the wrong block's pool. Safe — but it means a silent divergence between
   block order and paragraph order wouldn't error: it would just make the picker vanish,
   or worse, if counts still happen to match, attach a chip to the **wrong paragraph**.

## Please confirm (one line each)

- [x] `blocks[]` in §4.1 is always served in the same order the blocks appear in the
      assembled document text.
- [x] Every block in `blocks[]` contributes exactly one `"\n\n"`-joined segment to the
      served `text` (no zero-text blocks, no blocks excluded from the read while present in
      the variants payload — note §4.2 says candidate blocks are already excluded; we're
      assuming that holds for the GET too).
- [x] `block_key` **IS** guaranteed to equal `piece_key` (BE confirmed the stronger join).

If any of these doesn't hold, tell us what the stable join is (`block_key` ↔ `piece_key`,
a char range into `text`, whatever you have) and the FE re-anchors before the §10 sweep.

---

## ~~RESOLVED — BE confirmed all three (2026-08-03)~~ CORRECTED SAME DAY — checkbox 3 was WRONG

**The third confirmation above was never true and was not BE-confirmed.** `block_key` is
the skeleton's GAPPED key (0, 10, 20, … — gaps by design, so a candidate can sit between
two blocks; see `add_ideal_text_blocks.sql`), while `piece_key` is the served paragraph
INDEX (0, 1, 2, …). They coincide only on a single-block document. The pairwise-equality
cross-check built on it therefore returned null on every multi-block arc — failing closed
(every chip hid; no misattribution possible), but making the per-paragraph picker entry
silently vanish exactly where it matters most.

**The real answer to "tell us what the stable join is": backend #318 (merged 2026-08-03).**
The ideal-text GET's `pieces[]` entries now carry `block_key` themselves (master lane;
`null` on legacy/misaligned lanes — spec §4.1 updated). The FE join is now KEYED:
paragraph *i*'s chip is the block whose `blockKey` matches `pieces[i].blockKey`, wherever
it sits in the pool (`alignVariantBlocksWithPieces` returns a paragraph-aligned array; an
unmatched key stubs only ITS paragraph choiceless). Pieces without `block_key` (older BE)
fall back to the pairwise positional rule, which keeps failing closed. Checkboxes 1–2
stand. Nothing further blocks the §10 sweep from the FE side.
