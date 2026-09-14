# Handoff — readout per-slide, take cadence copy, best-presentation cleanup

**From:** FE · **Date:** 2026-06-21 · Context: live testing on willpowerlab.com.

The **top-priority FE** item is already done (readout now pages one snippet per screen — slide on top, text below, Back/Next, last → "Close"). The items below are the rest, split BE / FE.

---

## 🟦 BE PROMPT

**1. Stamp the slide on every readout snippet (so the slide shows on top).**
On the right-after-recording readout, snippets come back without a `slide`, so the FE has nothing to render above the text (it shows a bare text list, not slide-per-slide). The best-presentation endpoint already returns per-slide data — the readout should too. Ensure each readout snippet carries `slide: { index, title, body }` (from the tap timeline / `slide_for_snippet`), including for re-recorded takes. If a recording truly had no deck, returning `slide: null` is fine (FE shows text only).

**2. Baseline copy — don't promise 30 minutes; just say 3 takes. Short + concise.**
Current: *"Let's start with your natural baseline. You'll speak for about 30 minutes, aiming for at least 3 takes, with a short reset between each. This will help you explore…"* The natural baseline may run **less** than 30 min. Rewrite tight, e.g.: *"Let's start with your natural baseline. Record the same talk 3 times, with a short reset between each."* No time promise.

**3. Between-takes copy — tell them to do the next take, don't ask to retry.**
Current: *"Take 2 of 2: … This suggests a shift in emphasis. Would you like to focus on those sections and try again?"* Two problems: (a) it says "Take 2 of **2**" — should be **3**; (b) it asks "try again" as if redoing take 1. Reframe as the next take, e.g.: *"Take 2 of 3: now record the same talk again, looser — like telling a friend over coffee."* Imperative, not a retry question.

**4. Best-presentation text — no repeats, no half-cut sentences, pick compatible lines.**
The composed best-presentation repeats text across slides and includes fragments (half-cut sentences). In `select_best_per_slide` / the composition step: dedupe so the same line isn't reused on multiple slides; drop fragments that aren't complete sentences; prefer a complete, self-contained line over a truncated higher-scored one. The result should read as coherent prose per slide.

**5. (Supports FE #B) Readiness signal after the 3rd take.**
Confirm `…/best-presentation/progress` flips `ready:true` at ≥3 takes promptly so the FE can show a "view it now" note + button right after the 3rd recording. (Already returns `ready`/`takes_remaining` — just confirming it's correct on the 3rd-take boundary.)

**6. Per-take, per-slide FULL transcript (for the Trainings take viewer).**
Opening a take in Trainings shows *"No standout moment on this slide yet"* on most slides — the take payload only carries the single "standout moment," not the full transcript. Each take's per-slide data (in `/v2/user/strengths` `presentations[].takes[].slides[]`) should include the **whole transcript spoken on that slide in THAT take** — the take's raw, verbatim words, NOT the best-of composed text. Same per-slide shape as best-presentation, but per-take and verbatim. Include the slide's `audio_ref` + offset (start/duration) so the FE can play that slide back. So each take-slide returns roughly `{ index, title, body, transcript, audio_ref, start_offset_ms, duration_ms }`.

---

## 🟩 FE PROMPT

**A. Per-slide readout — DONE** (`ReadoutCard`, commit `065aea0`): one snippet per screen, slide on top, text below, Back/Next, last → "Close". Depends on BE #1 for the slide to actually render on top.

**B. "Your ideal presentation is ready" note + button after the 3rd take.**
Right after the 3rd recording, show a short, concise note in the thread (and/or at the end of the readout) — e.g. *"Your ideal presentation is ready."* — with a button that opens it directly (`BestPresentationOverlay` via the arc's `arcId`). The plumbing exists: `ProgressToAuditBubble` already flips to a "View your best presentation" button on `ready`, and `Lounge.onOpenBestPresentation(arcId)` opens the overlay. Make sure it appears promptly after take 3 (refetch progress on return) and the copy is one short line.

**C. Per-take slide transcript (Trainings take viewer).** Render the full per-slide transcript (BE #6) on each slide when viewing a take, replacing *"No standout moment on this slide yet."* Same slide-on-top layout as the readout. `LibraryOverlay` `MomentCard` / the take Deck mapping in `strengths.ts` — map the new per-slide `transcript` + audio fields and show the transcript below the slide.

**D. Per-slide playback in the right-after-recording readout.** Surface the audio player for each slide's text directly (it's currently only inside the tap-to-expand). Each readout snippet already carries `audioRef` + offset — render the `MediaPlayer` per slide so the user can play back what they said on that slide. (`ReadoutCard`.)

**E. Make the "Final" recording cards clickable.** The "Final / Training completed…" cards in the thread (`ReportCard`, `kind: "recording_summary"`/`"insight"`) should open that session's readout (`InsightsOverlay`) on tap. The card already routes via `onViewInsights`; ensure the whole card is tappable and a session id is present (confirm BE returns it on the summary/insight message).

**F. Persist the Trainings / Strong-sides chips.** When the bot sends a `trainings` or `strong_sides` suggested-action button, it must stay in the thread and survive reload / scroll-back — not vanish on the next turn. It's persisted via `message.metadata.suggested_action` and re-rendered by `coerceSuggestedAction`; verify nothing clears it and it renders on every render of that bot message.

Non-goals: don't rebuild the best-presentation rendering (BE #4 handles the text quality); the readout structure is settled (A).
