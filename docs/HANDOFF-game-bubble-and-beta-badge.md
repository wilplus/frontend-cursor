# Handoff — Voice Game Bubble + Beta Badge

**Last updated:** 2026-08-05.
**For:** the frontend agent picking these up.

---

## 1 · Voice Game Bubble

**Trigger: a voice is x3 verified.** That's it.

"x3 verified" = the album quorum, `backend-cursor/docs/SPEC.md` §9.1 — **model + coach + peer agree**,
or the override path where the coach and a peer agree and the model is overruled.

- **Fires when:** the user has an x3-verified voice.
- **Fires where:** the conversational chat, on return from the ideal text.
- **Not** on a new recording, a new library entry, a coach label alone, or a model guess. Only quorum.

**Which chat — there are two, and one is wrong:**

| | |
|---|---|
| `src/components/willab/Lounge.tsx` | ✅ the chat reached after the ideal text (`willab/IdealTextOverlay.tsx`) |
| `src/components/life/LifeChatLayer.tsx` | ❌ different surface; the user isn't here after the ideal text |

**Endpoint** — doesn't exist yet, needs a BFF route plus a backend route behind it. Return a boolean,
not a count:

```ts
GET /api/v2/voice-album/bubble-eligibility  ->  { "eligible": true }
```

The comparison stays server-side. A count that reaches the client can be rendered or logged, and AC-9
bans surfacing numbers to users.

**Copy needs founder sign-off** (LIVE LOOP). Build it, leave strings in a constant.

---

## 2 · Beta Badge — open, needs the founder

`src/app/panel/` has 14 routes (`data`, `goals`, `phrases`, **`principles`**, `today`, `week`, `wins`,
…). Principles is one of them.

**Recommendation: Principles only.** A chip in `components/life/PanelShell.tsx` appears on all 14 and
so claims `today`/`week`/`wins` are unfinished too. Where that's false and the user can see it, the
badge stops being believed where it's true. Widening later is one line.

Make it a small reusable `<BetaChip />` so scope is a placement decision, not a rewrite.

**"Beta" is user-facing copy — founder sign-off before it ships.**

---

**Back to the founder:** badge scope — Principles only, or a named list of routes?
