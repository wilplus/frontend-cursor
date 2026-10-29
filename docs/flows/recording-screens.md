# The recording screens

> **Label: In force** · one of the rules, read in N95's order. Every doc and its label: [the master doc](https://github.com/wilplus/backend-cursor/blob/main/README.md) (N106).

One page for the recording screens: the learning screen, mic ready, the recording screen with Back / Next slide, the keys and the sideways motion. Started 2026-10-21 (backend N107) from the founder lock it replaces, backend
[`FOUNDER-LOCK-recording-screens-2026-10-07.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/FOUNDER-LOCK-recording-screens-2026-10-07.md), which stays as history and is no
longer edited. It works like [`feedback-walk-and-chat.md`](feedback-walk-and-chat.md): §1 is the present, a
change is a line, and the design-lock check refuses a change to a file in `scripts/flow-pages.txt` without
this page.

§1 holds the lock as it stood on 2026-10-21, word for word, so every signed word stays as it was signed. Its
amendments follow its first text, and a later amendment wins over an earlier part. Paths in §1 are in the
backend repo unless they start with `src/`. Rewriting §1 in the present tense is open (§3).

---

## 1. The rules

`LOCKED 2026-10-07 · founder in chat: "Lock the recording screens" · decisions log N59`
`RE-LOCKED 2026-10-12 · founder in chat: "that's what i want; please lock it" · decisions log N70`

Clickable prototype (the reference for every screen, phone and desktop),
since 2026-10-12: <https://claude.ai/artifact/4zD6Tjw4MWjooqWq6z4FAL>,
version 4 (its v10 design), copy in
`docs/design/recording-screens-2026-10-12.html`. It replaces the scrolling
navigation of the 2026-10-07 prototype
(<https://claude.ai/artifact/9CFAAP2Ue7pvRdLvdesn9h>, version 7, copy in
`docs/design/recording-screens-2026-10-07.html`), which stays as history.
The flow and motion below are the 2026-10-12 design.
The frontend's CLAUDE.md carried the rule ("Design lock — the recording
screens") until 2026-10-11; that text is now in
[`docs/history/CLAUDE-2026-10-11.md`](../history/CLAUDE-2026-10-11.md), and today's
CLAUDE.md points here. This lock wins over the Ideal Text lock's line on Recording Mode
for the screens below.

### How the design came about (founder, chat, 7 October)

1. The recording screen for the first Take and for a Take with helper
   words, as a prototype "almost like the live one"; scrolling to the top
   must not reload the page.
2. "It should be scroll down to start; and no slide yet on the screen; it
   should be like a learning screen", without the recording button; on the
   web too, the scroll to the top never reloads the app; scrolls less
   sensitive; a smooth landing that follows the hand; a desktop version
   with its own start screen; the keyboard works without a click first.
3. "Make the slides only change like the rest of the infrastructure should
   stay; the scroll bar or top nav shouldn't move."
4. The drawing: "Recording" crossed out; "Take · Slide" moved up into the
   top bar.
5. "Delete the line right above [the] recording progress bar"; each slide
   one main colour; only a title and at most 1.5 sentences on a slide.
6. The stand-in deck fits any talk: introduce the subject, the main
   points, sum up and what to remember.

### Amended the same day (founder, chat, 7 October, after seeing the live build)

- "Make them orange!": every helper word is orange; the live screen had
  greyed the ones the data marks neutral.
- "Tighten the space below the Take 2 · Slide 2 of 3 and the slide; the
  margin there is too big, at least half that": the gap under the top bar
  is more than halved (about 44px to about 20px on a phone). Prototype
  version 7.

### The flow

1. **First recording (Take 1):** as every Take (amended 2026-10-12, N70:
   the learning screen, **Scroll down to start** / **Click down to start**,
   is deleted).
2. **Every Take:** **Getting your mic ready**, then the recording screen
   glides in. No learning screen, and nothing to approve: "Record Take N"
   goes straight here and the Take starts by itself. (Amended the same
   day, founder: the old "Your slides and speaking anchors are ready." /
   orange **Start recording** screen is deleted. The optional training
   question, which is consent, may still ask first.)
3. **The recording screen.**
   - Top bar: **Take N · Slide n of m** on the left (no "Recording"
     label), the close button on the right.
   - The slide, sitting close under the top bar, then the speaker's helper
     words below it, every one of them orange (none on Take 1), using the
     full width. No slide dots (removed 2026-10-12, N70).
   - The strip at the bottom: the recording dot, the clock, the bar. No
     line above the strip, and no Finish take in it (2026-10-12, N70).
   - Under the strip, two buttons side by side, equal width, in the coach
     panel's pair style (48px tall, 16px corners, 15px semibold): **Back**
     (white, thin border; greyed on the first slide) and **Next slide**
     (black). On the last slide **Next slide** becomes **Finish take**,
     red, with the stop square. Finish take is reached only from the last
     slide; closing asks **Discard this take?** (founder, 2026-10-12: "that's
     what i want").
4. **Close:** **Discard this take?** / "This recording has not been saved."
   / **Keep recording** / **Discard take**, as today.
5. **Finish take:** the processing wait (voice mark, stage label and its
   percent, **While you wait** tips). The bar shows 1% from the first
   second. The wait stays on screen when the Lounge takes the Take over, and
   lifts only when the walk's first step is on screen; then the walk, and
   the Ideal Text page after it (founder 2026-10-21, N110; the walk's page,
   [A1 and A2](feedback-walk-and-chat.md)).

### How it moves

Since 2026-10-12 (N70; founder: "we are resigning from the scrolling — it
was not practical").

- **Only the buttons change the slide.** A swipe, a scroll, a wheel or a
  trackpad never moves a slide. The helper words still scroll inside their
  own space when they are longer than it.
- **Sideways, like a deck.** **Next slide**: the slide and its helper words
  leave to the left and the next ones come in from the right. **Back**: the
  reverse. Out in 200ms, in from the other side in 420ms on
  `cubic-bezier(.16,1,.3,1)`. Instant with reduce motion.
- **Only the slide and its helper words move.** The top bar, the "Take ·
  Slide" line, the strip and the two buttons stay exactly where they are
  and are never rebuilt during a move.
- **Keyboard, no click first:** ← and → change the slide, exactly like
  Back and Next slide (N70.1); ↓, Page Down, Space forward and ↑, Page Up
  back, after scrolling long helper words. **Keys never end a Take**: on
  the last slide → and Space only give a small bounce; only the red Finish
  take ends it (founder, 2026-10-12). A focused button keeps its own Space
  and Enter; a text field keeps every key; nothing is taken while
  **Discard this take?** is open. Keys prototype:
  <https://claude.ai/artifact/LU1XgQyqY2nPSvDAmsRJFo> (version 2), copy in
  `docs/design/recording-screens-2026-10-12-keys.html`.
- **Never a reload:** pulling or scrolling at the top never reloads or
  refreshes the page, on a phone or on the web.

### The words

New with this lock (locked with the screens): **Take N · Slide n of m** in
the top bar. Signed 2026-10-12 (N70): **Back** and **Next slide**; **Finish
take** keeps its word. **Scroll down to start** and **Click down to start**
are retired with the learning screen. Signed 2026-10-18: **Same
presentation as Take 1** and **Same stand-in presentation as Take 1**, the
line under **Getting your mic ready** before a later Take. Every other word
on these screens is today's, unchanged.

The prototype's three slides are its own stand-in deck ("Introduce your
subject", "Make your main points", "Sum it up", navy, orange and dark
green); the app shows the speaker's own slides, unchanged.

### The rules

- Build these screens exactly as the prototype shows: no layout, flow,
  motion or wording change, and no element or string the prototype doesn't
  show. A task that seems to need one stops and asks the founder in the
  Navigation Panel, with a clickable prototype of the change.
- LIVE LOOP: this is the record → Take surface; every change keeps
  recording, saving and processing working.

### Amendments

- **2026-10-07 · one close button (Q-B14 A, N63; build plan D-RC-6).** The
  app's one small grey close X (`OverlayCloseButton`) is the close button
  everywhere, the recording screen included; the ⋯ beside it on the text
  page uses the same style.
- **2026-10-07 · the fade (Q-B14 A, N63; build plan D-RC-7).** Recording
  Mode is entered and left with a soft 0.4 s fade into and out of these
  white screens; instant with reduce motion. The fade never delays the
  recording.
- **2026-10-12 · buttons replace the scrolling (N70).** Back and Next slide
  under the strip; Next slide becomes a red Finish take on the last slide;
  no slide dots; slides move sideways; the learning screen is deleted.
  Prototype <https://claude.ai/artifact/4zD6Tjw4MWjooqWq6z4FAL> (version 4),
  copy in `docs/design/recording-screens-2026-10-12.html`.
- **2026-10-12 · the arrow keys (N70.1).** ← → change the slide; keys never
  end a Take; a focused button keeps Space and Enter. Prototype
  <https://claude.ai/artifact/LU1XgQyqY2nPSvDAmsRJFo> (version 2).
- **2026-10-18 · which presentation a later Take uses.** Founder's Linear
  issue "Second take falls back to the first take's presentation"
  (2026-10-16): every Take is said against Take 1's presentation (the
  uploaded file, or the stand-in deck Take 1 used), and the speaker sees
  which one before recording. Before every Take after the first, one line
  in the same small grey sits directly under **Getting your mic ready**:
  **Same presentation as Take 1** when Take 1 had the speaker's file,
  **Same stand-in presentation as Take 1** when it used the stand-in deck.
  Nothing on Take 1, nothing else on the screen moves. Words and placement
  chosen by the founder in chat, 2026-10-18, from the decision page
  <https://claude.ai/artifact/JUwW4FfFzyUhgCpPrMAKjG>.
- **2026-10-23 · the screen stays on while a Take records (N116).** While the
  mic records, the app holds the browser's screen wake lock, so a phone
  cannot lock itself on a long slide and cut the mic off; it asks again when
  the page is back in view and lets go when the Take ends. Nothing on screen
  changes. Lives in `src/hooks/useDualCaptureMic.ts`.
- **2026-10-29 · new slides inside the project (N257).** A project's deck
  can be added or changed inside the project (the Ideal Text page's ⋯, or
  the chat). The line under **Getting your mic ready** says **New slides**
  on the first Take after the change (the setup read's `deck_changed`),
  and from the next Take **Same presentation as Take {n}**, {n} the Take
  the deck was first used on (`deck_since_take`; Take 1 when not sent).
  The stand-in line is unchanged. The Take records with the setup read's
  newest deck. Signed in the Claude Code chat, 29 October 2026, on the
  prototype <https://claude.ai/artifact/8heRv4BC6fGg7EzuzuTo4A>.
- **2026-10-29 · one project at a time (N254).** The "+" opens the
  projects. **Start a new project**, or a project that is not the current
  one (the one with the newest Take), first asks **One project at a time**
  · **"{current}" will be archived. Its Takes and Ideal Text stay safe, and
  you can bring it back from Data & consent.** · **Cancel** | **Continue**.
  Continue archives the current project, then goes on as before; Cancel
  stays on the list. Picking the current project, a draft, or an account
  with no Take yet asks nothing. A failed archive says "Couldn't archive.
  Try again." and nothing goes on. Lives in `ProjectPicker.tsx` and
  `OneProjectQuestion.tsx`.


## 2. In flight

One line per piece of work: `item · what it is · the rules it touches · where it stands · PR`. The session
doing it fills its line in its PR and deletes the line when the work is merged (the change goes to §6).

- **The plan's two touches on the set-up** · the topic arrives filled in from the plan's voice message (backend N141); "How do you feel?" shows before every practice between a plan's first and last, and the stress and readiness ratings take its place on those two (backend N151, N157) · the set-up's first question and the feelings check · built, on for ring 5 since 27 October 2026 (N203, N204, backend #1394): "Start your first recording" opens the set-up with the topic filled in and no feelings check; with an active plan, every later Take opens "How do you feel?" first, with a Skip (a new project's first Take shows it with a Skip too, N211), only after the plan's own yes (N217), then the project's stored setup · rules: [`the-plan.md`](the-plan.md) §1 B7, D

## 3. Still open

- **§1 in the present tense.** §1 is the lock as written, with its amendments after it. The next change to
  this screen rewrites the part it touches in the present tense, the way the walk's page did (backend N107).

## 4. Where it lives

Frontend, guarded by `scripts/flow-pages.txt` (a change must change this page):

- `src/components/willab/LabOverlay.tsx`
- `src/components/willab/FinishTakeButton.tsx`
- `src/components/willab/RecordingRoadmap.tsx`
- `src/components/willab/recordingCopy.ts`
- `src/components/willab/useRecordingGestures.ts`
- `src/lib/willab/recordingGesture.ts`
- `src/components/willab/DiscardTakeDialog.tsx` — "Discard this take?" (step 4) (guarded since N111).
- `src/components/willab/RecordingAnalysisPresentation.tsx` — the wait while a Take is processed (step 5) (guarded since N111).
- `src/components/willab/ProcessingWait.tsx` — "While you wait" (step 5) (guarded since N111).
- `src/components/willab/SlideStage.tsx` — the slide on the recording screen (guarded since N111).
- `src/components/willab/labFade.tsx` — the fade between the screens (guarded since N111).

Backend (`wilplus/backend-cursor`): the lock file this page replaces, [`docs/FOUNDER-LOCK-recording-screens-2026-10-07.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/FOUNDER-LOCK-recording-screens-2026-10-07.md) (history).

## 5. Prototypes

Every prototype link in §1, in the order it first appears:

- <https://claude.ai/artifact/4zD6Tjw4MWjooqWq6z4FAL>
- <https://claude.ai/artifact/9CFAAP2Ue7pvRdLvdesn9h>
- <https://claude.ai/artifact/LU1XgQyqY2nPSvDAmsRJFo>
- <https://claude.ai/artifact/JUwW4FfFzyUhgCpPrMAKjG>
- <https://claude.ai/artifact/8heRv4BC6fGg7EzuzuTo4A>

## 6. Changes

One line each, newest first: `date · N · what changed · PR`.

- 2026-10-29 · N254, N257 · built: the "+"'s "Start a new project", or another project than the one with the newest Take, asks "One project at a time" first and Continue archives the current one (`ProjectPicker.tsx`); the line under "Getting your mic ready" says "New slides" on the first Take after a deck change, then "Same presentation as Take {n}" (`presentationInPlay.ts`, `LabOverlay.tsx`). Was: any number of projects side by side, and always "Same presentation as Take 1" · FE (this PR), BE (with it)
- 2026-10-27 · N217 · "How do you feel?" says "Your coach sees your answer." under "Before you step on stage" (signed with Privacy 3.9, question 1 A: answering is the yes for that one answer); on a plan it is asked only after the plan's own yes, and without it the check is passed by at once and keeps nothing, as a Skip (`FeelingsCheckIn.tsx`, `plan.ts`). The plan's yes is switched off (`PLAN_CONSENT_ENABLED`) until Privacy 3.9 is published, so today every plan reads as yes. Was: asked of every speaker with no word on who sees it · FE (this PR), BE (with it)
- 2026-10-27 · N211 · "How do you feel?" has a Skip wherever it shows, a new project's first Take included (`FeelingsCheckIn.tsx`); skipping keeps no feeling. Was: a Skip only between a plan's first and last practice · BE #1408
- 2026-10-26 · N151, N178, N203 · with an active plan, "How do you feel?" comes before every Take but the plan's first, with a Skip (`FeelingsCheckIn.tsx`, `useWillabFlow.ts`); the plan's first Take opens the set-up with the topic filled in. Was: once per new project, before Take 1, no Skip · BE #1386, FE #1018

- 2026-10-26 · docs audit · the pointer to CLAUDE.md's "Design lock" section names its history copy; no rule changed · —
- 2026-10-23 · N116 · the screen stays on while a Take records; the Take's audio is kept in one-second pieces and an empty recording is never sent (it is asked for again) · BE #1268, FE #942

- 2026-10-21 · N111 · the page also guards the recording screens' files it missed: the discard dialog, the wait while a Take is processed, the slide and the fade (§4); no rule changes · BE, FE
- 2026-10-21 · N110 · the flow, 5, in the present tense: the wait starts at 1% and stays on screen through the hand-over to the Lounge until the walk's first step is on screen, in place of "the processing wait as today (voice mark, stage label, **While you wait** tips), then the Ideal Text page" · FE #931, BE #1245
- 2026-10-21 · N107 · this page replaces backend `FOUNDER-LOCK-recording-screens-2026-10-07.md` as the place the rules live; the lock stays as history · BE #1241, FE #928
