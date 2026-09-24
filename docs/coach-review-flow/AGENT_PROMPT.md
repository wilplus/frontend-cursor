# Prompt for the coding agent

> Paste this verbatim as the opening instruction. Everything it refers to is in
> `docs/coach-review-flow/` in the frontend repo.

---

You are implementing the willab **coach review flow**. Your implementation must
match the design **one to one**. Read these three files before you write a line
of code, in this order:

1. `docs/coach-review-flow/HANDOVER.md` — the flows, the design contract, the
   interaction rules, the shipped code, and the open items.
2. `docs/coach-review-flow/SPEC.md` — the founder-specified design. Every fork
   in it was decided explicitly.
3. `docs/coach-review-flow/prototype.html` — open it in a browser and walk it.
   It is a single self-contained file, no build. This is what the flow should
   feel like.

Then read `CLAUDE.md` at the repo root and run the **WILLAB DECISION FILTER** on
your task before starting. Emit its VERDICT + REDIRECT block. This is not
optional and it is not a formality — it is the gate that stops this product
drifting.

## The one rule that matters most

**Ask every single time something is even slightly unclear.** Do not guess, do
not infer from surrounding code, do not pick "the reasonable default", do not
leave a `TODO` and move on, and do not quietly choose one reading of an
ambiguous sentence. Your development has to match this design exactly, so a
plausible-looking guess is worse than a question — it ships as though it were
decided, and nobody finds out until a coach hits it.

The order of escalation:

1. **Look in `HANDOVER.md`, `SPEC.md` and `prototype.html`.** Most answers are
   there, often as an explicit ruling with the reason attached.
2. **Look at the code on current `main`.** The flow is already merged; the
   existing components are the reference implementation.
3. **If neither answers it — stop and ask the founder** (artur@willonski.com)
   **immediately.** Do not batch questions until the end. Do not build around
   the gap. Ask when you hit it, and wait.

**No ambiguity may be left in the code.** If you finish a piece of work and any
part of it rests on an assumption you made rather than an answer you were given,
that assumption is a defect — surface it explicitly in your PR description and
flag it as needing a ruling.

## Things that are already decided — do not re-open them

- **Judgement comes first.** The student screen has **one** door and it leads to
  the blind pass, not to the machine's guesses.
- **One action per screen.** If a screen grows a second competing action, you
  have broken the design.
- **The ideal text is optional, never a gate.** Both the UI skip and the backend
  permit publishing without it. Do not add a gate; the old UI-only one is the
  exact bug this flow fixed.
- **One delivery per arc**, not per take. One message, one review, one publish.
- **Save is automatic.** There is no "Save feedback" button. Leaving the
  Feedbacks review is what commits.
- **One button idiom** — the big black button. No button inside a button, no
  helper texts, no box inside a box, no scrim without a slide behind it.

## Things that will fail your PR

- Breaking **AC-9** (a score, number, ratio or verdict reaching a user),
  **CONSTRUCT**, **BLIND COACH / N1**, **N2** (re-sorting the band-shuffled
  queue), **N3** (a default answer), or the **LIVE LOOP**.
- Breaking **L1 / L2 / L3** (see `HANDOVER.md` §6).
- Editing `blindLabelingIsBlind.test.ts` to make it pass. When markup moves, the
  fence follows the markup — it is never relaxed.
- Raising the complexity ratchet on a grandfathered function.
- Changing any user-facing string without founder sign-off. Small is not exempt.
- Reordering the overlay mounts in `Lounge.tsx` without understanding why they
  are in that order (§2 — it is a real bug, not a style preference).

## Before you push

Run everything in `HANDOVER.md` §8 — typecheck, lint, unit tests, the complexity
ratchet, the blind-labeling fence, Playwright — **and then drive the flow in a
real browser**. Three of the bugs in this flow were invisible to every test and
obvious within ten seconds of actually using it.

Branch off current `origin/main` (which has moved well past the original merge)
and ship via a gate-routed PR.

## Known gaps waiting on the founder

These are listed in full in `HANDOVER.md` §7. Do not close any of them on your
own judgement:

1. The CMS **return leg** (`returnTo`) is not built — nothing in `src/app/cms/`
   reads it, so the exercise hand-off is currently one-way.
2. The CMS **admin-password gate** bounces a coach arriving from the review.
3. **Publishing without an approved ideal text** is intended today; changing it
   is a founder decision and a backend change.
4. `/coach/audit/[studentId]` renders a raw score and has no server auth gate —
   a live AC-9 exposure, outside this flow. Raise it, do not silently fix it.
