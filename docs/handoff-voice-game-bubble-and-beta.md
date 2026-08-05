# Handoff — Voice Game Bubble + Beta Badge

**Last updated:** 2026-08-05.
**For:** the frontend agent picking these up.

---

## 0 · Status at a glance

| | |
|---|---|
| **Voice Game Bubble** | **DEFERRED — do not start.** Blocked on backend work, steps 1–3 below. |
| **Beta Badge** | **DONE** (2026-08-05) — see §2. |

---

## 1 · Voice Game Bubble — DEFERRED

**Trigger: a voice is x3 verified.** That's it.

"x3 verified" = the album quorum, `backend-cursor/docs/SPEC.md` §9.1 — **model + coach + peer
agree**, or the override path where the coach and a peer agree and the model is overruled.

- **Fires when:** the user has an x3-verified voice.
- **Fires where:** the conversational chat, on return from the ideal text.
- **Not** on a new recording, a new library entry, a coach label alone, or a model guess. Only
  quorum.

**Which chat — there are two, and one is wrong:**

| | |
|---|---|
| `src/components/willab/Lounge.tsx` | ✅ the chat reached after the ideal text (`willab/IdealTextOverlay.tsx`) |
| `src/components/life/LifeChatLayer.tsx` | ❌ different surface; the user isn't here after the ideal text |

**Endpoint** — doesn't exist yet, needs a BFF route plus a backend route behind it. Return a
boolean, not a count:

```ts
GET /api/v2/voice-album/bubble-eligibility  ->  { "eligible": true }
```

The comparison stays server-side. A count that reaches the client can be rendered or logged, and
AC-9 bans surfacing numbers to users.

**Copy needs founder sign-off** (LIVE LOOP). Build it, leave strings in a constant.

---

### ⛔ 1.1 · Why this is deferred, and what has to land first

**Do not start at step 4.** The FE bubble is the cheap 10% of this; the other 90% is standing up
quorum computation, which is its own piece of work.

The blocking fact is **mechanical, not doctrinal**: nothing in the codebase can currently answer
*"has this voice reached x3?"*

- `aggregate()` exists in `backend-cursor/services/state_ratings.py` but **is not wired to any
  route**.
- Quorum needs a **peer vote**, which comes from the game lane, and those aren't flowing yet.

So the trigger cannot fire. Building the bubble now ships a surface whose condition is
unreachable — in three places, with a migration — and at ~15 coach labels/week plus peer votes
that aren't flowing, the condition may not be met for months.

**The sequence, in order. Each step is a prerequisite for the next:**

1. **Compute quorum (backend, the real work).** Wire `aggregate()` to a route so "has this voice
   reached x3?" is a question the system can answer at all.
2. **Fire on the rating write path (backend).** `maybe_fire_voice_album_ready(...)`, modelled on
   the existing `services/arc_notifications.py::maybe_fire_best_presentation_ready(db, arc_id)`
   — same shape, called at the moment a rating could complete quorum.
3. **Add the lounge kind (backend + frontend + migration).** See §1.2 — this is the step that
   silently breaks CI if done incompletely.
4. **The FE bubble.** Small, once 1–3 exist.

---

### 1.2 · "New lounge kind" is a three-place change, and one will fail CI if missed

```
1. services/lounge_messages.py     VALID_KINDS            (backend)
2. migrations/add_*_lounge_kinds   the DB CHECK mirror    ← test_lounge_kind_migration.py
                                                            FAILS CI without this
3. src/services/api/loungeMessages LoungeKind union       (frontend)
```

The backend comment says it outright: *"adding a kind here without a new migration fails CI."*

---

### 1.3 · Filter verdict

```
VERDICT:  DEFER
CATEGORY: SCAFFOLDING
WHY:      it is the album's delivery surface, not F1 transcription or ranking. The blocking fact
          is mechanical, not doctrinal: quorum is not computed, so nothing can fire the trigger.
REDIRECT: if the album is the priority, the F2-advancing step is wiring aggregate() to a route so
          quorum exists at all — the bubble is downstream of that and cheap once it lands.
```

---

## 2 · Beta Badge — DONE

**Scope: the WHOLE life panel** (founder 2026-08-05, asked and answered explicitly).

The earlier recommendation in this doc was *Principles only*, on the reasoning that a chip on all
14 routes claims `today`/`week`/`wins` are unfinished too, and a badge that is false where you can
see it stops being believed where it's true. **The founder chose the whole panel.** Recording the
overruled reasoning here so it isn't re-litigated: the call was made with the tradeoff visible.

**Shipped:**

- `src/components/life/BetaChip.tsx` — a small reusable chip, so a future scope change is a
  placement decision rather than a rewrite.
- Rendered in `src/components/life/PanelShell.tsx`, in the nav row, **outside** the scrolling pill
  strip. Inside it would scroll away with the pills, and a testing-phase marker that is only
  sometimes on screen is not a marker.

**"Beta" is user-facing copy — still held for founder sign-off** (LIVE LOOP), like every other
string shipped in this batch.
