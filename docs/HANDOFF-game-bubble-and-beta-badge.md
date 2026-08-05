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

## 2 · Beta Badge — DECIDED: the whole Life panel

**Founder decision, 2026-08-05: the chip goes on the entire Life panel, not just Principles.**

Put it in **`src/components/life/PanelShell.tsx`** so it renders across all 14 routes (`data`,
`distractions`, `goals`, `phrases`, `principles`, `setup`, `strategy`, `timeline`, `today`, `week`,
`wins`, …). One placement, one chip, no per-route logic.

Build it as a small reusable `<BetaChip />` even so — scope then stays a placement decision rather
than a rewrite if it ever narrows.

*(Recommendation had been Principles-only, on the grounds that a panel-wide chip also claims
`today`/`week`/`wins` are unfinished. Founder chose panel-wide. Recorded, not reopened.)*

**"Beta" is user-facing copy — founder sign-off on the exact string before it ships.** Build the
component, leave the text in a constant.
