# Deck builder: design audit log

Method: each round I drive the prototype in headless Chrome (390×844 phone and 1280×860 desktop) through the whole flow, typing and using the simulated mic. I read every screenshot and score five criteria from 1 to 10.
- Target: every criterion at 9 or higher.
- A 9 means a demanding product designer would ship it as a prototype with only minor nits.
- Screenshots for each round are in `research/audit/rN/`.

Reference flow: Gamma's Agent flow, mobile chat-only editing with dictation. Details in `speech-to-presentation-research.md`.

---

## Round 1: audit of v2 (baseline, before redesign)

Screens: `research/audit/r1/` (v2 mobile 01–07, `v2-desktop-structure.png`, `v2-desktop-style.png`).

| # | Criterion | Score | Why |
|---|---|---|---|
| 1 | Usability / ease of use | **6** | Calm and uncluttered, and reorder/edit work. But most abilities are invisible: there's no undo, no way back to a pass, and no way to add or remove slides. Long bot bubbles carry the instructions, and they scroll away. |
| 2 | Clarity of next steps | **6** | "Say 'looks good'" exists, but only once, buried mid-bubble. The composer placeholder is a generic "Tell me what to change". Once you scroll, the next step is invisible. A first-time user won't know whether to tap, type or talk. |
| 3 | Speech-to-presentation fit | **4** | The mic is a simple toggle. The transcript appears only at the end (nothing live), and there's no hold-to-talk. You can't interrupt while the bot works, and there's no "thinking" vs "building" state. Voice can't undo, go back, or regenerate a slide. It's typing with a mic button, not a voice loop. |
| 4 | Flexibility | **5** | Reorder (3 ways), inline text edit and visual add/remove/change work. Missing: undo, back to an earlier pass, regenerate one slide, add/delete slides (refused on purpose in v1), restore a version, and scoping an edit to one slide. |
| 5 | Beauty of generated slides | **4** | Every slide uses the same "text left, small thing right" layout. Copy is generic template placeholder ("The simplest possible fix, in one sentence."). Charts are toy-sized with fake labels, and "AI photo" pills on gradients look unfinished. There are no layouts per slide type (stat, steps, team, quote, ask) and only system fonts. On desktop the slides look empty (see `v2-desktop-style.png`). Far from Canva quality. |

### Issues to fix (prioritised)

**Voice**
- V1: no live transcript.
- V2: no hold-to-talk.
- V3: can't interrupt the build.
- V4: listening, thinking and building aren't distinct states.
- V5: the simulated mic produces text without the feel of dictation.

**Next steps**
- N1: the next step is only in old messages.
- N2: the placeholder is generic.
- N3: suggested phrases aren't actionable.

**Flexibility**
- F1: no undo.
- F2: no way back to a pass.
- F3: no per-slide regenerate.
- F4: can't add or remove slides.
- F5: can't scope an edit to one slide.
- F6: can't restore an approved version.

**Beauty**
- B1: a single layout for everything.
- B2: placeholder copy.
- B3: charts lack hierarchy and annotation.
- B4: photo placeholders don't look intentional.
- B5: system fonts only.
- B6: themes differ only in colour.

**Flow**
- G1: the separate "visuals-ask" step is an extra turn. Gamma builds with sensible defaults, then you adjust.
- G2: there's no "plan" framing for the structure pass.
- G3: style starts from a blank question, not concrete options.

### Redesign plan for round 2 (mirroring Gamma's flow)

- **Brief:** ask "who's it for + what should happen" (a ramble is fine). Skip the follow-ups if the answer already covers them. "You decide" is always accepted.
- **Structure:** called the "plan". Reorder by drag, tap or voice; tap to edit text; add or delete slides; "another version of slide 3"; undo.
- **Visuals:** on "looks good", a live narrated build, one slide at a time, with suggested visuals (no visuals-ask turn). Per-slide scope by tapping a slide; "different visual"; "remove the chart"; undo; "back to structure".
- **Style:** three looks as real thumbnails of your title slide, tappable or spoken ("the second one"). A vibe or Canva link also works, plus photos (generated or your own), accent, font and animation. "Different layout" per slide. "done" finishes.
- **Composer (voice):**
  - Tap to dictate with a live transcript streaming into the field.
  - Hold to talk; release sends.
  - The send button becomes stop while busy, and talking interrupts.
  - The placeholder always says the next step.
- **Slides:** a new renderer with a layout per slide type, Google Fonts (Inter, Fraunces, Nunito, Space Grotesk; all OFL), real chart axes and annotations, and art-directed photo placeholders. Copy comes from the brief, with richer, specific sample copy.

---

## Round 2: audit of the first v3 build

Screens: `research/audit/r2/`. That includes mobile 01–16, desktop d1–d5, every final slide (`slide-01…08`), and a theme gallery (`theme-*`). The e2e run was 32/32 after two test-timing fixes, with 0 console errors.

What changed since round 1:
- **Flow:** Gamma-style. Brief questions with "you decide" → plan → a live narrated build, slide by slide, with skeletons → 3 looks → fine-tune → final, viewer and practise.
- **Voice:** tap to dictate (live transcript: final words dark, interim words grey); hold to talk (release sends, slide away cancels); pressing the mic or ■ while the bot works interrupts it.
- **Editing:** undo for every change in a pass, back to the plan or visuals, regenerate / add / delete a slide, and tap a slide to scope edits to it (a "Slide N ×" chip appears).
- **Guidance:** tappable phrases inside replies fill the field and never send. A stepper shows Brief · Plan · Slides · Look.
- **Slides:** a new design system with a layout per type: cover, statement, chart split, steps, timeline, icon points, big number, team, quote, product mock-up, photo and closing. Real axes and highlighted values, a "Sample data" tag, 6 themes, Inter / Fraunces / Nunito / Space Grotesk (OFL).

| # | Criterion | Score | Why |
|---|---|---|---|
| 1 | Usability / ease of use | **8** | Everything works by touch and by voice. Bug: saying "the first one" / "the second one" for a look fails, because "one" is normalised to "1" (`deckNormalize`). During the build the view stays on the skeletons and doesn't follow the slide being drawn (scroll offset counted twice). |
| 2 | Clarity of next steps | **8** | The placeholder always names the next step and the stepper shows where you are. But the placeholders wrap onto 2 lines at 390px, and nothing explains tap vs hold until you read the first bubble. |
| 3 | Speech fit | **8** | The voice loop is real: live transcript, hold-to-talk, barge-in. But a voice look pick is broken (bug above), and replies are text only, so you have to look at the screen after every spoken change. |
| 4 | Flexibility | **8** | Undo, back to a pass, regenerate, add/delete, per-slide visual and layout, upload, Canva link. Missing: going back to a specific earlier version (e.g. "v1.2"). |
| 5 | Beauty | **8** | Big jump: proper hierarchy, per-type layouts, good charts, themes that feel distinct. Problems: the desktop viewer clips the top of the slide (`justify-content:center` on an overflowing stage). Placeholder art is captioned "Generated photo", which is misleading. A global change rings every slide, which looks noisy. |

Changes for round 3:
- Fix the ordinal parsing.
- Fix the build-follow scroll (use the rect delta).
- Shorten every placeholder to one line.
- Show a first-use hint in the dock ("Tap the mic to dictate · hold it to talk, let go to send").
- Add `restore vX.Y`: every state before a change is kept under its version tag, and the restore itself can be undone.
- Viewer: `safe center` alignment, with the slide width capped by the viewport height.
- Photo caption becomes "Photo · …".
- Highlight ring only when ≤3 slides changed.

---

## Round 3: audit after the interaction fixes

Screens: `research/audit/r3/`. The e2e run was 37/37 with 0 console errors. New checks: build view follows the slide, voice ordinal pick, restore, undo of a restore.

All round-2 interaction bugs are verified fixed:
- `06b-building-slide5.png`: the view sits on slide 5 while "Slide 5 of 8 · laying out the 3 steps" is shown.
- `d5-viewer.png`: the viewer is no longer clipped.

For this round I also built three **non-sample decks** (Q3 update, sales proposal, conference talk) to check that beauty isn't just the tailored WillpowerLab copy: `research/audit/r3/generic/`. That surfaced real problems.

| # | Criterion | Score | Why |
|---|---|---|---|
| 1 | Usability / ease of use | **9** | One composer and one gesture model. Every core path is covered by the e2e test and works by touch and voice. Nit: in-chat slide text is small on a phone, but the viewer is one tap away (⤢). |
| 2 | Clarity of next steps | **9** | One-line next-step placeholder in every state, plus the stepper (done steps are tappable to go back), the first-use gesture hint, "Undo: …" in the dock, and the narrated status line. |
| 3 | Speech fit | **8.5** | Everything is reachable by voice, including restore and undo. Still text-only replies, so it isn't eyes-free. |
| 4 | Flexibility | **9** | Undo chip; restore any earlier version; back to any pass from the stepper or by voice; regenerate, rename, add, delete; reorder by voice, drag or tap-to-place; per-slide visual, layout and photo; Canva link; edit from inside the viewer (an edit applies to the slide on screen). |
| 5 | Beauty | **7.5** | Sample deck: 9. **Generic decks: clearly worse, so the honest score drops.** Q3 update (`generic/q3-*`): a stat slide reads "80k / to"; the user's 80k→140k numbers are ignored for the chart, which shows sample bars labelled 2022–2026; there's a "use of funds" donut on a team update; points read "Win one / Win two". Sales (`generic/sales-*`): "What changes with Proposal Acme"; a WillpowerLab app mock-up appears in a client deck; an invented, unlabelled customer quote. Those aren't Canva-quality, and some are dishonest. |

Changes for round 4:
- **Speech:** after a spoken turn, I say the first line of the reply out loud (Web Speech `speechSynthesis`). Talking cuts me off. "Be quiet" / "read it out" toggle this.
- **Content:** parse "X grew from A to B" into a metric, the real values and a % change. The big-number slide uses "+75% · Revenue, 80k → 140k". The results chart uses the real two points (Q2 → Q3), and sample periods follow the deck type (quarters for updates, months for sales).
- **Stat captions:** reject stop-word captions ("to", "from"…).
- **Auto-visuals:** only suggest what can be filled honestly.
  - No icon row without real points, and no big number on non-metric slides.
  - No quote unless the user gave one (or it's the tagged sample); quotes carry a "Sample quote, tell me a real one" tag; a quote in "quotation marks" becomes theirs.
  - No generic steps or timeline on a story slide; no donut ask outside pitches.
- **Names:** the sales name comes from the client ("What changes for Acme Logistics"). The user's one-sentence answer becomes the key line ("We grew 75% and Q4 is about retention" is the headline slide; "Sleep is the best study tool you have" is the big idea).
- **Templates:** idea pieces already used by a dedicated slide aren't repeated as points.
- **Mock-ups and numbers:** in non-WillpowerLab decks the device mock-up is a neutral "Your product screenshot" frame. Big numbers are compacted (80k, 140k).

---

## Round 4: final audit

Screens:
- **Final set:** `shots/v3/`. Mobile 01–16, desktop d1–d5, all 8 final slides, the theme gallery, and `shots/v3/generic/` with Q3 update, sales and talk decks.
- **Round copy:** `research/audit/r4/`.

Checks:
- **E2e:** 37/37 with 0 console errors (`build/e2e-test-v3.mjs`).
- **Generic decks:** 3 × 8 slides with 0 errors (`build/e2e-generic-decks-v3.mjs`).
- **Prototype lock:** the 14 approved contracts still verify against this file.

| # | Criterion | Score | Why |
|---|---|---|---|
| 1 | Usability / ease of use | **9** | Mic + text + send is the only input. Tap, hold, type, tap a phrase, or tap a slide all lead to the same intent handler, and nothing needs a manual. Every flow passes in the e2e test on phone and desktop. Not 10: in-chat slide text is small on a phone, and drag-reorder exists only in the plan. |
| 2 | Clarity of next steps | **9** | You always see where you are (stepper), what to say next (one-line placeholder), what I'm doing ("Slide 5 of 8 · laying out the 3 steps · talk to interrupt"), and how to take it back ("Undo: moved …"). Selection scopes are explicit ("Slide 6 ×", "What changes on slide 6?"). Not 10: version tags like v3.4 are a little technical. |
| 3 | Speech fit | **9** | A true speak → see → speak loop:<br>• Live transcript with tap or hold.<br>• Barge-in by talking or ■, and the replies stop talking when you start.<br>• Short spoken confirmations after spoken turns.<br>• Voice for every action: undo, restore, back, regenerate, select-by-name, look by ordinal, viewer navigation and edits, practise.<br>Not 10: recognition is simulated in headless runs, so real-ASR accuracy and latency are untested. |
| 4 | Flexibility | **9** | Undo, restore any version, back to any pass, regenerate one slide, add/delete/rename/rewrite/shorten, 3 reorder methods, per-slide visual, layout and photo, global look, accent, font, scale, minimal, motion and photos, Canva link, edit from the viewer. Not 10: no multi-select, and you can't merge or split slides. |
| 5 | Beauty | **9** | Across the sample and 3 generic decks:<br>• Clear type hierarchy (kicker / display title / body), with a layout fitted to each slide type.<br>• Charts with real axes, a highlighted last value and honest "Sample data" tags.<br>• Distinct, consistent themes (`theme-*`).<br>• No more nonsense slides (`generic/*`): every visual is now either filled with the user's own content or clearly tagged as a sample.<br>Not 10: photo slots are art-directed placeholders, not real photography. Some generic placeholders remain ("Now / Next / Later" milestones, "And where it leads" when only two points were given). |

**Result:** every criterion is at 9 or higher after 4 rounds. Round 1 audited v2; rounds 2–4 audited v3, with fixes between rounds.

### Known limitations (honest)
- **The AI is mocked.** Rules and templates stand in for the LLM, so copy quality on unusual briefs is bounded by the templates.
- **Voice is simulated** in headless tests, by streaming words. Real `SpeechRecognition` and `speechSynthesis` are wired up but only work in browsers that support them (Chrome, Safari). Firefox falls back to the simulation.
- **Photos are placeholders.** They're CSS/SVG compositions in theme colours, captioned "Photo · …"; a real build would generate or search photos.
- **The Canva link is mocked.** It applies a matching theme; real import would need Canva's API or a PDF.
- **No competitor in-app screenshots.** Those apps need logins; the research uses public pages and og images only.
