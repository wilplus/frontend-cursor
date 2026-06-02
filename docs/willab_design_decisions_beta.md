# willab — Design Decisions (Developer Reference)
**Audience:** the developer / coding agents implementing the commercial beta.
**Companion to:** `willab_user_story_beta.md` (Spec v1.1 — the source-of-truth user story). This doc is the **design-decisions consolidation** and folds in the **v1.2 deltas** (see §9). Where this doc and v1.1 differ, the v1.2 delta list is authoritative; everything else defers to the spec.
**Organization:** by component. Each section = purpose → locked decisions → states (where relevant) → code grounding → per-component deletions. Cross-cutting deletions and backend work are collected in §8 / §10.
**Two corrections folded in from the latest review** (don't implement the older versions):
- **Status region is a linear, single-active model** — one official recording in flight at a time, `pending → delivered → back to launch`. *Not* the earlier concurrent stack of session cards. This overrides Spec §5's concurrency DEFAULT.
- **The Lounge bot is a librarian, not a progress engine** — it retrieves and replays the coach's notes; it never computes or asserts "you're improving."

---

## 1. Foundations (type + bubble vocabulary) — *done, referenced here*
**Type roles used downstream** (actual scale lives in the Foundations work; these are the roles other components reference):
- **Display** — large hero numerals (e.g. the Readout's two hero features, 22px).
- **Heading** — section/attribution headers (e.g. "From your coach").
- **Body** — transcript, feature values, AI/coach commentary (the readable substance).
- **Meta** — labels, counters, scores, timestamps (the quiet scaffolding).

**Bubble vocabulary** — chat message "kinds" are an enumerated set. One kind is being **retired** this phase (`metrics`, see §8).

---

## 2. Lounge (home hub)
**Purpose:** the always-mounted home surface. Off-task, calm, brand-toned. Everything launches from and returns to it.

**Locked decisions**
- **Always mounted.** The Lab opens as an overlay *over* the Lounge (§3); the Lounge instance and its live chat thread persist underneath and are restored on overlay close with **no remount**.
- **Open chat — text or speech**, user's choice, functionally identical, both **unmeasured**. Speech uses the **Web Speech API** (local, free); it is **not** the Whisper pipeline.
- **Mic ownership:** the Lounge speech input is **released/paused for the entire lifetime of the Lab overlay** so only the Lab's `MediaRecorder` holds `getUserMedia`; it resumes on overlay close.
- **Persistent "Start official recording" CTA** — always available, **never blocked** by an in-flight or parked session.
- **Optional warm-opener** — the repurposed former onboarding opener (light brand-tone first touch). Optional flavor only; **must never block or delay the launch CTA**; detached from the first-run path.
- **Status region pinned to the top** (§5).
- **The Lounge bot** — see §6 for its full context + the librarian guardrail.

**Persistence (BE handoff — see §10):**
- Signed-in: server-backed `lounge_messages` (survives reload + device switch).
- Unsigned: `localStorage`; **merges chronologically into the server thread on sign-up** (append, never overwrite).
- In-memory is ruled out.
- **Guardrail:** the thread feeds **only** the bot's conversational recall — never `inferred_learner_profile`, never cross-session analysis. Disclosed in first-run consent; user-deletable; never in the coach packet.

---

## 3. Lab (official recording — overlay + training zone)
**Purpose:** the high-stakes, on-task surface. The single official recording happens here. Visually and behaviorally distinct from the Lounge.

**Locked decisions**
- **Overlay, not a route.** Launched over the always-mounted Lounge; closing returns to the Lounge underneath with no remount. *(If an agent wires this as its own route, the hub model breaks — this is a STOP-and-check item.)*
- **Explicit "training zone" chrome.** Distinct from the Lounge: own header conveying official + not-yet-sent (e.g. **"Official recording · not yet sent"**), no casual Lounge affordances inside. The user always knows: in the Lab = on-task; in the Lounge = off-task.
- **Holds the mic** (`getUserMedia` → `MediaRecorder`) for its lifetime; Lounge speech input released (§2).

**Step A — `session_context` (per recording; 1 : many against the one-time profile)**
- **Topic** — *required* (feeds stickiness "topic coherence", Whisper vocabulary priming, prompt relevance, coach interpretability).
- **Audience** — optional.
- **Target length** — optional.
- **Domain vocabulary** — auto-derived from the profile domain; editable.
- The profile **goal** shows as a read-only reminder.
- Friction target: near-zero — everything but topic is pre-filled/optional.
- **Do not** merge `session_context` into the one-time profile; **do not** cut it.

**Step B — pre-record → record → process**
- Pre-record: the prompt/task + high-stakes framing + a single large record control (distinct from the Lounge's small inline mic).
- **Min-content gate (salvaged from the removed onboarding completion gate):** reject recordings lacking speech or under the minimum duration. **Default: ≥60 s + has-speech.** Failing recordings → re-record prompt, never sent. This is a **content-validity gate only** — there is no charisma/stress contrast requirement.
- Process: progress state; **Whisper** (vocabulary-primed from `session_context`) → **ffmpeg** → **librosa** → segmentation → stickiness scoring + comment.

**Completion semantics (critical)**
- **Completion = Send to coach. The Readout is NOT the finish line.**
- **Park, don't discard, post-recording.** Diverging out of the Readout — including tapping "What do these mean?" — **parks** the session: the Lab minimizes to a **"Finish your recording → Send"** chip in the Lounge status region; the processed recording is **held and resumable**; re-entry restores the Readout at the Send step.
- **Discard rules:**
  - Mid-recording (`lab_recording`): discard-on-confirm (no artifact worth keeping).
  - Post-recording, pre-send (`lab_processing` → `readout` → `parked`): **explicit discard only**, plus the unsigned-session-end sweep.

**States introduced:** `lab_session_context`, `lab_prerecord`, `lab_recording`, `lab_processing`, **`parked`** (first-class post-recording state).

**Per-component deletions:** the onboarding **charisma/stress recording interview** and the **≥1-charisma / ≥1-stress / ≥60 s contrast completion gate** are removed; only the min-content check survives, relocated here.

---

## 4. Readout (the core payoff screen)
**Purpose:** "here's your voice as data." Neutral, factual, **non-interpretive** — it hands the verdict to the coach. This is the no-judgment promise in screen form.

**The two-stage story (frame the whole component around this)**
| Moment | Surface | Content | Tone |
|---|---|---|---|
| Right after recording | **Readout** (in the Lab overlay) | raw features + AI-stickiness + AI comment | neutral, factual |
| When analysis returns | **Insights** (in the Lounge, §5) | the **human coach's** notes + message, on the same data | personal, interpretive |

**Locked decisions**
- **Sequential reveal → summary list.** One snippet card at a time, tap-to-advance (a paced payoff, not a data dump), then a scrollable list of all cards to revisit.
- Lives inside the Lab overlay; closing **parks** (§3), it does not discard.

**Snippet card anatomy**
```
┌──────────────────────────────────────────┐
│ Snippet 2 of 5                    [▶ 0:08] │  Meta + SnippetPlayer (reused)
│ "…and that's when I realized the whole…"   │  transcript — Body
│                                            │
│   148 wpm            32% paused            │  2 HERO features — Display (22px)
│   speech rate        pause ratio           │  labels — Meta
│                                            │
│  PITCH        F0 mean 165 Hz · SD 28 Hz    │  3 grouped sections
│  PACE & PAUSE mean pause 0.4s · regular    │   label = Meta, value = Body
│  VOLUME/VOICE range 14 dB · voiced 71%     │
│   ▸ Show dynamics (F0 slope, envelope…)    │  progressive disclosure — 4 derived
│                                            │
│  ── Stickiness ──────────────────────────  │
│  "You stayed on one idea and built on it…" │  AI comment — Body (the main thing)
│  composite 0.72                            │  score — Meta, NEUTRAL (no red/green)
└──────────────────────────────────────────┘
   "Your personal baseline builds over your first
    few sessions; these are raw values."          baseline line — Meta
        ▸ What do these mean?  → opens Lounge, bot primed
   [ Send to my coach for analysis ]   persistent primary footer → send gate
```

**The locked specifics**
1. **Hero pair = speech rate + pause ratio** (Display). The two a non-expert feels immediately. **F0 mean stays in the grouped Pitch section, not a hero** — Hz is noise up top without a baseline.
2. **Grouped rest:** the other 8 features in 3 plain-language groups — **Pitch / Pace & Pauses / Volume & Voice**.
3. **"Show dynamics" expander** for the 4 abstract derived features (F0 slope, pause regularity, intensity-envelope shape, F0 mid-vs-end delta). Hierarchy is intentional: equal-for-the-classifier ≠ equal-for-a-human.
4. **Stickiness = comment-first, score-second, neutral-colored.** No good/bad, no red/green.
5. **Baseline line included** (flips Spec DEFAULT #4): *"Your personal baseline builds over your first few sessions; these are raw values."* It preempts the "is this good?" anxiety on the card.
6. **Science lives in the bot, not in tooltips.** A single **"What do these mean?"** link drops the user into the Lounge with the bot primed. **No inline per-feature explainers.** (Diverging here parks the session — §3.)
7. **Persistent send footer:** `Send to my coach for analysis`, always visible under the cards → send gate.

**Code grounding**
- **Reuse `SnippetPlayer`** for per-card playback.
- Type roles: **Display** = the 2 hero numbers; **Body** = transcript + comment + values; **Meta** = labels + score + baseline line.

**Per-component deletions:** retire the session-level **`AcousticMetricsBubble`** (wpm/pitch/flow/fillers/dynamic/energy as a chat bubble) and its **`metrics` bubble kind** — the Readout is per-snippet, richer, and a focused screen, not a chat bubble. (`SnippetPlayer` is kept.)

---

## 5. Status region + Insights view
**Purpose:** the Lounge's pinned top area — where the parked chip lives and where the coach's commentary lands.

### 5a. Status region — LINEAR single-active model
The loop is **linear: one official recording at a time.** `record → (Readout) → send → with coach → insights delivered → back to launch.` So the status region is **not** a stack of concurrent session cards. It shows, at most:
```
┌─ LOUNGE (status region pinned above chat) ─────────┐
│  [ ▶ Start official recording ]      always present │
│  ⚠ Best-man speech · recorded, not sent   Finish & send ›   (parked — if one exists)
│  🕓 Q3 update · with your coach                              (review_pending — transient)
│  ✨ Investor pitch · insights ready          Read ›          (insights_ready — transient)
│ ─────────────────────────────────────────────────── │
│  …continuous chat thread below…                      │
└──────────────────────────────────────────────────────┘
```
| State | Card (label = `session_context.topic` + state) | Action |
|---|---|---|
| `parked` | ⚠ "*[topic]* · recorded, not sent" | **Finish & send ›** → re-opens the Lab Readout (training chrome) at the Send step |
| `review_pending` | 🕓 "*[topic]* · with your coach" | none — passive, **no time estimate** |
| `insights_ready` | ✨ "*[topic]* · insights ready" (+ 💬 if a coach message exists) | **Read ›** → opens the Insights view |

**Locked behavior**
- `review_pending` and `insights_ready` are **transient states of the current session**, not items that accumulate. Once insights are **read**, the session's coach-annotated snippets **fold into the strong-sides library** (§6) and the status region returns to just the launch CTA. **Past sessions live in the library, not as a growing card stack here.**
- **`parked`** is the one state that persists across a divert, until the user sends or explicitly discards.
- **Empty state:** no cards — just the Start CTA + chat. The region is invisible until there's something to show.
- This **replaces** the earlier "read → archive list" and the ready/parked/pending/read ordering; with single-active, ordering is moot.

**Signal wiring (reuse existing infra):** the `pending → ready` flip is already wired — **`usePublishLiveSubscription`** (realtime) + **`useReviewingFetch`** (poll fallback), fired by the admin-publish event; email half = **`ResultsReadyEmail`**. **Re-point these from the retired `reviewing` phase at the status region.**

### 5b. Insights view — "commentary when it comes back"
Tapping **Read ›** **re-opens that session's Readout, now with the human layer added on the same data** (annotated Readout — confirmed reuse).
```
┌─ Insights · Investor pitch ───────── (Lounge chrome, read-only, CALM) ─┐
│  💬 From your coach                                                    │  overall coach message
│  "Strong open. Watch the drop-off when you hit numbers — let's…"        │   Heading + Body, human/warm
│ ─────────────────────────────────────────────────────────────────────│
│  Snippet 2 of 5   [▶]  "…and that's when I realized…"                   │  SAME Readout card,
│    148 wpm · 32% paused · pitch 165 Hz …                               │   raw data unchanged
│    AI stickiness: "stayed on one idea…"            (neutral, automated) │   automated layer
│    🧑 Coach: "this is your strongest 8 seconds — do more of this"        │   NEW human layer, attributed
└─────────────────────────────────────────────────────────────────────────┘
```
**Locked decisions**
- **Reuses the Readout cards** — transcript + raw features + AI-stickiness, untouched — and adds **two coach layers**: an **overall coach message** (top) and **per-snippet coach notes**. *(Both layers confirmed — per-snippet notes are the raw material for the library.)*
- **Two commentary layers, clearly attributed.** AI-stickiness comment stays **neutral/automated**; the **🧑 Coach** note is **warmer, human-attributed, visually distinct**. The user never confuses the app's read with the coach's read.
- **Read-only, Lounge chrome (calm)** — *not* the Lab's training chrome. A payoff to read, not a task to do.
- **In-app is canonical**; email is a nudge. Opening it flips the card out of `insights_ready`.
- **On read → ingest into the strong-sides library** (§6).

---

## 6. Strong-sides library + Lounge bot context
**Purpose:** the user's growing, personal collection of *the coach's own notes* — and the bot's ability to hand it back on request. This is the in-scope feature; a progress engine is **not**.

**Locked decisions**
- **New persistent store (BE handoff — §10).** After each **delivered** session (on read), it ingests the **coach-annotated snippets**: snippet + raw data + the coach's note, tagged **strong / to-work-on**. It grows session over session.
- **Bot context = master science doc *+* this user's library.** The bot can retrieve and replay coach notes, surface strong/weak snippets, and offer to pull them up.
- **Librarian, not judge — hard guardrail.** The bot **retrieves and replays human-authored coach notes**. It **must not compute or assert trajectory, improvement, decline, or any cross-session synthesis.** "Are my strong moments here, in my coach's words?" = yes. "Am I improving?" = the bot does **not** answer with a computed verdict.
- **The bot's standing offer is invitational, not evaluative**, e.g.: *"Whenever you want to refresh your strong lines or work on the weaker ones, I'm here."* (register, not a mandated string)

**Why the guardrail exists (write it into the prompt + the doc):** surfacing the coach's past notes is replaying content the user already received — safe. Synthesizing "you're progressing" across sessions is the **post-PhD Learning Effectiveness System** and is explicitly out of scope this phase. The library is a **retriever of human-authored notes**, never a **judge of arc** — same no-judgment spine as the Readout, now at the bot layer. **STOP-and-check: do not let the librarian become a progress engine.**

**Existing bot guardrails still hold:** explains general science freely from the master doc; must not fabricate the user's result/score/T:C ratio; must not pre-empt the coach's read.

---

## 7. Full state model (single source of truth)
1. `welcome_consent` — first run only.
2. `intake_in_progress` — interview surface, first run only, **non-recording** (profile capture: domain + goal).
3. `lounge_idle` — home; optional warm-opener may greet.
4. `lab_session_context` — Lab overlay; per-recording context (topic required).
5. `lab_prerecord` — prompt shown, mic permission.
6. `lab_recording` — capturing audio.
7. `lab_processing` — Whisper/ffmpeg/librosa.
8. `readout` — snippets revealed; Send available.
9. **`parked`** — recorded, not sent; held + resumable; "Finish your recording" chip in Lounge.
10. `sendgate_unsigned` / `sendgate_signed`.
11. `review_pending` — with coach; passive; no time estimate.
12. `insights_ready` — email + in-app; optional coach message; **Read** opens annotated Readout.
13. `lounge_general` — open chat anytime; bot has master doc + library.

**Loop:** linear, one active recording at a time. On read, coached snippets → library, status returns to launch. `parked` persists across diverts until sent/discarded.

---

## 8. Master deletions / relocations list
**Delete**
- `AcousticMetricsBubble` component **+** the `metrics` bubble kind. *(Replaced by the per-snippet Readout cards. Keep `SnippetPlayer`.)*
- The onboarding **charisma/stress recording interview** and the **contrast completion gate** (≥1 charisma + ≥1 stress + ≥60 s). *(Salvage only the min-content check → Lab, §3.)*
- The **next-session icebreaker** AI auto-prefill + the session-2 first-question wiring (Task 10). *(BE columns may remain dormant. Concept repurposed as the coach-authored message, §5b.)*

**Relocate / repurpose (do NOT delete the asset)**
- Onboarding **opener** (`useOnboardingOpener`, `OpenerMicButton`, `/opener/*` BFF, `dad_jokes`): **detach from the first-run path**, re-mount as the **optional Lounge warm-opener** (§2). Must never gate the launch CTA.

**Retire (re-point, don't rip out the signals)**
- The old **`reviewing` phase**: re-point `usePublishLiveSubscription` + `useReviewingFetch` + `ResultsReadyEmail` at the **status region** (§5a).

---

## 9. Spec v1.1 → v1.2 delta (fold into the user story)
1. §4.7 DEFAULT #4 + §8.4 → **baseline line included** (copy locked in §4.6 above).
2. **Delete `AcousticMetricsBubble` + `metrics` bubble kind** (keep `SnippetPlayer`).
3. **Readout card anatomy** locked (§4): hero pair, 3 groups, "Show dynamics" expander, comment-first neutral stickiness, "What do these mean?" → Lounge.
4. **Park-not-discard:** new first-class `parked` state; refine §6.5/§6.6 (mid-recording = discard-on-confirm; post-recording pre-send = held/resumable, explicit-discard-only); "Finish your recording" chip.
5. **Lab "training zone" chrome** ("Official recording · not yet sent"; no Lounge affordances inside).
6. **Status region = linear single-active model** — overrides §5 concurrency DEFAULT and §8.8; `review_pending`/`insights_ready` are transient states of the current session.
7. **Insights view = annotated Readout**, two attributed commentary layers (neutral AI + human Coach) + overall coach message.
8. **Strong-sides library** store + bot context expansion (master doc + library) + **librarian-not-judge** guardrail.
9. **`session_context`** as the per-recording intake (topic required), distinct from the one-time profile.
10. **Coach-authored message** surfaced in status/insights (no AI session-N+1 opener).

---

## 10. Backend handoffs (new work the original BE doesn't have)
- **`lounge_messages` store** — server-side per signed-in user; `localStorage` + merge-on-sign-up for unsigned; continuity-only, never profiled, deletable, never in coach packet.
- **Strong-sides library store** — ingests coach-annotated snippets (snippet + raw data + coach note, tagged strong / to-work-on) on each delivered session's read; read by the Lounge bot.
- **`session_context` record** — per Lab recording, 1 : many against the one-time profile; defaults inherited from profile (vocabulary from domain).
- **Signal re-point** — `usePublishLiveSubscription` + `useReviewingFetch` + `ResultsReadyEmail` from the retired `reviewing` phase → the status region.
- **Coach-side authoring** — overall message + per-snippet notes per session (the admin/coach surface that produces the Insights payload).

---
*Locked decisions only. Open red-lines are exhausted through the core loop. Anything not covered here defers to Spec v1.1 / v1.2.*
