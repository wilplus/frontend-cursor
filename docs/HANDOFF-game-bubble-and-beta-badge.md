# Handoff — Voice Game Bubble + Beta Badge

**Last updated:** 2026-08-05.
**For:** the frontend agent picking up these two items.
**From:** the architecture session that produced `backend-cursor/docs/SPEC.md` v3 §0.1 (D19–D31).

Two questions came back. **One is already answered by the spec and must not be re-decided; the other is
genuinely open and needs the founder.** They are handled separately below because they have different
statuses, and treating the first as an open design question is how a locked decision gets quietly
relitigated.

---

## Q1 · The Voice Game Bubble — the trigger IS specified

> *"This doesn't exist yet. What exactly triggers this to appear in the chat? (e.g. when a new voice is
> added to the library?)"*

**Not "a new voice is added."** The trigger is the **album quorum**, and it is already locked.

### The rule

`backend-cursor/docs/SPEC.md` **§9.1**:

> A moment enters the album at **three-way agreement** — model, coach, peer. The model's vote is
> **asymmetric by design**: it can help a moment in, never keep one out.
>
> **The override path:** where the coach marks a moment the model rejected and a peer confirms it,
> **two humans is sufficient** and the model is overridden.

Founder, in the session that settled this:

> *"then when they leave the ideal text, in the conversational chat, there appears the bubble if we
> collect sufficient x3 verified confident moments"*

and earlier, defining what `x3` means:

> *"only x3 (model, coach, peer …) agree or more makes it to the voice album"*

So `x3` is **three-way verification**, not "three moments." Putting it together:

| | |
|---|---|
| **Fires when** | the user has ≥ N moments that have **cleared album quorum** (model + coach + peer, or the coach + peer override) |
| **Fires where** | the **conversational chat**, on returning from the ideal text — not in the album, not in the panel |
| **Does not fire on** | a new recording, a new voice in the library, a coach label, or a model guess. **None of those is quorum.** |

### The one thing genuinely open: N

`N` — how many quorum-cleared moments before the bubble appears — **is not specified anywhere.** The
founder's word was "sufficient." Do not guess it in the component; read it from a single named constant
so it can be changed without a hunt.

Ask the founder for N. If you need a placeholder to build against, use `3` and mark it `TODO(founder)`
— but do not ship it as though it were decided.

### Which chat — and this is easy to get wrong

There are **two** chat surfaces in this repo:

| Surface | File | Correct for the bubble? |
|---|---|---|
| **Lounge / willab chat** | `src/components/willab/Lounge.tsx` | ✅ **yes** — this is the chat the user reaches after leaving the ideal text (`src/components/willab/IdealTextOverlay.tsx`) |
| Life panel chat | `src/components/life/LifeChatLayer.tsx` | ❌ no — different product surface; the user is not here after the ideal text |

Picking the second puts the bubble somewhere the trigger condition never coincides with the user.

### Fences on this bubble — all hard, all from `backend-cursor/CLAUDE.md`

1. **AC-9 — no numbers.** The bubble may **not** say "you have 3 confident moments" or show any count,
   score or progress figure. The read is qualitative. A count is a number, and a number is the fence.
2. **BLIND COACH — no model guess.** The bubble may not reveal what the model thought, before or after.
   The whole point of quorum is that agreement is reached blind.
3. **LIVE LOOP — copy needs founder sign-off.** Write the component; **do not ship final strings.** Put
   placeholder copy behind a clearly marked constant and flag it for review. "It's just a tiny copy
   tweak" is R13 in the filter's rationalization catalog — small is not exempt.
4. **The established pattern for "we have your input, wait":** the founder specified elsewhere that the
   user sees *"registered — let's wait for the coach"*, **never the answer**. If the bubble has any
   pending state, match that pattern.

### API — does not exist yet

There is **no endpoint** that returns "how many of this user's moments have cleared quorum." The album
quorum lives backend-side and is not exposed through the BFF. You will need one added under
`src/app/api/v2/*` and a backend route behind it.

**Shape it so the count never crosses the boundary** (AC-9):

```ts
// GET /api/v2/voice-album/bubble-eligibility
{ "eligible": true }        // ✅ a boolean the FE can render on
{ "eligible": false }

// NOT this — the count is the fence
{ "quorum_moments": 4 }     // ❌
```

The threshold comparison happens **server-side**. If the count reaches the client it can be rendered,
logged, or leaked into an analytics payload, and AC-9 is gone. Server-side comparison makes that
structurally impossible rather than a rule someone has to remember.

---

## Q2 · The Beta Badge — genuinely open, and here is the reasoning

> *"Should this small chip go just on the Principles page, or on the entire Life panel?"*

**Not previously decided.** Needs the founder. Below is the recommendation and why, so the question can
be answered in one round rather than three.

### The surfaces, concretely

`src/app/panel/` has **14 routes**: `data`, `distractions`, `goals`, `phrases`, **`principles`**,
`setup`, `strategy`, `timeline`, `today`, `week`, `wins` (+ layout/error/loading/not-found). Principles
is **one of fourteen**.

- **"Whole Life panel"** = a chip in `src/components/life/PanelShell.tsx` → appears on all 14.
- **"Principles page only"** = a chip in `src/app/panel/principles` → appears on 1.

### Recommendation: Principles only

A beta badge is a **claim about a specific surface's stability**, not decoration. Scope it to what is
actually unstable:

- On `PanelShell` it asserts that `today`, `week`, `wins` and `data` are also unfinished. For anything
  already shipped and stable that is **false**, and a badge that is false where the user can check it
  stops being believed where it is true.
- **If everything is beta, nothing is.** A panel-wide chip carries no information; a page-specific one
  tells the user exactly which ground is moving.
- Reversal is cheap in the right direction. Starting narrow and widening later is a one-line change and
  reads as honesty. Starting wide and *removing* badges reads as a quiet retreat.

**The rule to hand back to the founder:** put the chip on the routes that are actually still changing.
If Principles is the only one, it goes there alone. If three of the fourteen are in flux, it goes on
those three — which argues for a small reusable `<BetaChip />` rather than a placement decision baked
into either shell.

### Fence

**LIVE LOOP again — the word "Beta" is user-facing copy and needs founder sign-off.** Build the chip,
leave the string in a constant, do not decide the wording.

---

## What to hand back to the founder

Two questions, both one-liners:

1. **N** — how many quorum-cleared moments before the bubble appears?
2. **Badge scope** — Principles only (recommended), or a named list of routes?

Plus one item to confirm rather than decide: the bubble needs a **new BFF endpoint** returning a
boolean, and a backend route behind it. That is not FE-only work and should be sequenced with whoever
holds `backend-cursor`.

## Do not do

- Do not trigger the bubble on a new recording, a new album entry that has not cleared quorum, a coach
  label alone, or a model guess. Only quorum.
- Do not render any count, score, percentage or progress bar (AC-9).
- Do not surface the model's guess in any state of the bubble (BLIND COACH).
- Do not ship final copy for either item without founder sign-off (LIVE LOOP).
- Do not put the bubble in `LifeChatLayer`.
