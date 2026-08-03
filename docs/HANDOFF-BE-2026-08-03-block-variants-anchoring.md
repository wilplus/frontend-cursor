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

- [ ] `blocks[]` in §4.1 is always served in the same order the blocks appear in the
      assembled document text.
- [ ] Every block in `blocks[]` contributes exactly one `"\n\n"`-joined segment to the
      served `text` (no zero-text blocks, no blocks excluded from the read while present in
      the variants payload — note §4.2 says candidate blocks are already excluded; we're
      assuming that holds for the GET too).
- [ ] `block_key` is NOT guaranteed to equal `piece_key` (we deliberately don't join on
      it — say so if it IS guaranteed, since that would let us drop the positional
      assumption for something stronger).

If any of these doesn't hold, tell us what the stable join is (`block_key` ↔ `piece_key`,
a char range into `text`, whatever you have) and the FE re-anchors before the §10 sweep.
