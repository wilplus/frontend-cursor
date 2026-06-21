# Chat bot audit — BE + FE prompts

**From:** FE · **Date:** 2026-06-21 · Source: live audit of the `/chat` Lounge Q&A (`POST /v2/chat/query`, guest), ~15 prompts across topics.

Headline: the bot answers product-FAQ well and refuses prompt-injection, but it behaves like a **product librarian, not a speaking coach** — it inconsistently deflects the very anxiety questions its audience asks, has buggy language handling, leaks some off-topic generative requests, and never emits the record CTA (the FE already renders it). Most fixes are BE (prompt + master doc + funnel flags).

---

## 🟦 BE PROMPT — chat bot (`/v2/chat/query`) behavior fixes

Audit of the live anonymous Lounge bot surfaced these. Each item has real evidence.

**1. Make on-topic scope consistent — and lean toward *helping*, not deflecting (highest impact).**
The audience is "anyone with speaking anxiety", but the bot answers some core anxiety questions and deflects near-identical ones:
- "my **voice** shakes, what can I do?" → real, helpful advice. ✅
- "how do I stop my **hands** shaking on stage?" → *"I can't provide specific advice on that topic."* ❌
- "how do I handle tough Q&A when I'm scared?" → helpful ✅
Decide the bot's role and enforce it. Recommendation: it *is* a light speaking-anxiety/delivery coach — answer general nerves/delivery questions helpfully (that's the core need), and reserve deflection for genuinely unrelated topics. The line currently wobbles run-to-run (RAG-bound to the master doc); broaden coverage of common speaking-anxiety asks.

**2. Language: always reply in the user's language; never deflect non-English core questions.**
- "What's the capital of France?" replied **in Spanish** on one run, English on a repeat (same question) — non-deterministic wrong-language.
- A **Polish** core question ("how to stop stressing before a public talk") got *"I can't answer this"* + a product pivot, while the English equivalent got real help. Non-English core questions must be answered in-language, not deflected.

**3. Close the off-topic generative leak — deflect consistently.**
- "Write me a haiku about the ocean" → it **wrote the haiku**. But "tell me a joke" → correctly deflected. The bot can be used as a free general-purpose LLM. Deflect all non-mission generative requests the same way.

**4. Emit the conversion flags on readiness/intent (the acquisition lever).**
The FE already renders these (it sets the mic invite on `show_record_ui===true` and a button on `suggested_action`), but the bot never sent them in the audit — even on "I want to get better, **how do I get started?**" (`show_record_ui:false`, `suggested_action:null`). On clear readiness turns, return `show_record_ui: true` + `suggested_action: "record_again"` so the user gets a one-tap path to record. Valid `suggested_action` values the FE accepts: `"strong_sides" | "trainings" | "record_again"`.

**5. Verify the confident factual claims in the master doc.**
The bot states as fact: pricing **"$5 per iteration, $100/mo unlimited"** and latency **"feedback within a few hours."** If the master doc is stale it's quoting wrong numbers to prospects — confirm both are current.

**6. Warmer, safer sensitive-topic path.**
"I'm having a panic attack right now" → it avoided medical advice (good) but pivoted coldly back to *"come back to voice training."* Add a brief empathetic acknowledgement + a "if this is an emergency, reach out to someone you trust or a professional" line before any product redirect.

**Already good (keep):** product-FAQ answers (what it is, how it works, human-led + AI-assist), prompt-injection refusal, declining to ghost-write whole speeches (offers to coach delivery instead).

---

## 🟩 FE PROMPT — chat bot (mostly verification; FE is already wired)

The conversion flags are **already consumed** — no functional FE change is needed for the record CTA; the gap is BE-emission (above). Scope this as verify + lock-in:

1. **Confirm the wiring** in `src/components/willab/Lounge.tsx`: `setShowRecordUi(resp.show_record_ui === true)` (~:389) reveals the mic invite (~:508); `suggested_action` is coerced (`coerceSuggestedAction`, `loungePrompts.ts`) and rendered as the single matching button (~:368-386, :732). `chatQuery.ts` types these (`show_record_ui`, `suggested_action: "strong_sides"|"trainings"|"record_again"|null`).
2. **Add a regression test** (pure, against the response→render mapping): `show_record_ui:true` ⇒ mic invite shown; `suggested_action:"record_again"` ⇒ record button rendered; absent/null ⇒ neither. Locks the contract so when BE starts emitting the flags, the CTA appears.
3. **Do NOT** build a parallel/always-on record CTA — let the BE flag drive it (avoids double affordances).
4. **End-to-end check once BE ships #4**: ask "how do I get started?" and confirm the mic invite + record button render in the Lounge.
5. Empty/"can't answer" 2xx replies already fall back gracefully (`chatQuery.ts` librarian-empty path) — no change needed.

**Non-goals:** language, scope, pricing, sensitive-topic copy are all BE (prompt + master doc); nothing for FE there.
