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
   - **The poster** (backend N462, the prototype "Your one thing"
     <https://claude.ai/artifact/6L2C5Uj7AiJbRaES4cxzb1>): with no uploaded
     deck, the first Take's questions, the default presentation (Opening,
     Main points with its 1 2 3 as tiles, Summary) and an answer's question
     are drawn as one idea in the middle of the dark slide: the label in
     small spaced capitals, quiet; the question large and heavy, centered a
     little above the middle; the hint quiet under it; no orange line. It
     fills the slide's space down to the strip, a mark for each slide under
     it, when the Take has no helper words; with helper words it keeps the
     16:9 box, so they keep their place. An uploaded deck is drawn as
     itself. Was: the question at the bottom with the orange line (N449),
     the default deck on its colour artwork, an answer's small line.
   - The strip at the bottom: the recording dot, the clock, the bar. No
     line above the strip, and no Finish take in it (2026-10-12, N70).
   - Under the strip, two buttons side by side, equal width, in the coach
     panel's pair style (48px tall, 16px corners, 15px semibold): **Back**
     (white, thin border; greyed on the first slide) and **Next slide**
     (black). On the last slide **Next slide** becomes **Finish take**,
     red, with the stop square. Finish take is reached only from the last
     slide; closing asks **Discard this take?** (founder, 2026-10-12: "that's
     what i want"). With one slide there is no Back: Finish take alone fills
     the row (backend N441 item 6).
4. **Close:** **Discard this take?** / "This recording has not been saved."
   / **Keep recording** / **Discard take**, as today.
5. **Finish take:** the processing wait, one narrow centred column (the
   breathing mark, the stage label and its percent, a rounded bar, and under
   it **Usually about a minute.**; nothing to read or scroll, N271, N273;
   prototype <https://claude.ai/artifact/S66ZsrqTQZ4se74caoCj2J>).
   The bar shows 1% from the first second. The wait stays on screen when the Lounge takes the Take over, and
   lifts only when the walk's first step is on screen; then the walk, and
   the Ideal Text page after it (founder 2026-10-21, N110; the walk's page,
   [A1 and A2](feedback-walk-and-chat.md)).
6. **An answer in a chat** (backend N363, N441, approved for this lock):
   the screens opened from a chat's "Record an answer" record it as any
   Take, on one slide holding the question (N361 item 3), with no "How do
   you feel?" before it. The top bar is the person's name alone; the slide
   is the poster, **{name} asks** as its label and the question as its
   heading (N462; was N441 item 7: a small line, the question in body
   size). The clock is any Take's: an answer has no five-minute cap
   (N486 item 4), its project has no planned length, so the clock counts
   up and the answer ends at Finish take. Was (N441 item 2): the clock
   counted down from 5:00 and at 0:00 the Take finished by itself. Was
   (N363, N334 item 2): the name above
   **Take 1 · Slide 1 of 1**, the question as the slide's heading, a clock
   counting up. Finish take brings the speaker straight back
   to that chat, where the answer reads "Sending to {name}…" with Undo
   (N345): no processing wait and no walk in between; the Take processes
   on its own, its walk waiting in Will's chat. An upload that fails shows
   its usual error here, with its retry. The answer's project never
   becomes the speaker's current one, and no community share applies to
   it. The speaker's own Takes keep step 5.
7. **A question to someone** (backend N483 item 4, N498, approved for this
   lock): "Record your question" in a chat's "Ask {name}" opens these
   screens at once on the default presentation (Opening, Main points,
   Summary, the poster slides, N462), with no "How do you feel?" before it.
   The top bar reads **To {name} · Slide {n} of 3** in place of "Take N";
   the clock counts up as any Take's. Finish take goes back to that chat as
   an answer does (step 6): "Sending to {name}…" with Undo, no processing
   wait and no walk in between, the screens hidden while the Take uploads
   and shown again only for its error; its project, named "To {name}",
   never becomes the speaker's current one.

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
  recording. "How do you feel?" before a later Take opens with no fade, at
  once on the tap (N549).
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
- **2026-11-03 · a phone call pauses the Take (N437 item 2).** When iOS takes
  the mic for a call (or another app's audio), the recorder pauses, and it
  carries on from where it stopped when the mic comes back; the clock stops
  and goes on with it, and a slide tapped after it keeps its time in the
  voice, so the call is not in the Take. Nothing new on screen. A mic that
  never comes back leaves the Take paused: Finish still hands over what was
  said (a prototype comes to the founder before anything is built for that
  case). Lives in `src/hooks/useDualCaptureMic.ts` (`getPausedMs`) and the
  clock and slide taps in `LabOverlay.tsx`.
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
  you can bring it back from Settings.** · **Cancel** | **Continue**
  ("Settings" in place of "Data & consent", N260).
  Continue archives the current project, then goes on as before; Cancel
  stays on the list. Picking the current project, a draft, or an account
  with no Take yet asks nothing. A failed archive says "Couldn't archive.
  Try again." and nothing goes on. Lives in `ProjectPicker.tsx` and
  `OneProjectQuestion.tsx`.
- **2026-10-29 · the same question in the chat (N260).** Will's **Create
  new project** button asks it too, when there is a current project: the
  grey card with the title and the sentence takes the message box's place,
  as the WhatsApp ask and the slides upload do, then **Cancel** |
  **Continue**. Continue archives the current project and opens the new
  project's setup as before; Cancel brings the message box back and leaves
  the button under Will's reply. With no current project it starts at
  once. Signed on the prototype
  <https://claude.ai/artifact/Ta5hMGw8EbA6ewUssUugMK>. Lives in
  `OneProjectQuestion.tsx` and `Lounge.tsx`.
- **2026-10-29 · why the microphone (N273 item 4).** On Take 1, while the
  browser asks for the microphone, one line in the same small grey sits
  directly under **Getting your mic ready**: **WillpowerLab uses the
  microphone to record your Takes.** (N269's sentence). No new screen and no
  tap; the Take still starts by itself once the mic is allowed. Later Takes
  keep their presentation line. Signed in the Claude Code chat, 29 October
  2026, on the prototype <https://claude.ai/artifact/6AVcGS1ksx86KzvUPyKEes>.
  Lives in `recordingCopy.ts` and `LabOverlay.tsx`.
- **2026-11-03 · the voice as it is (N372).** The mic records with the
  browser's call processing off (automatic gain, noise suppression, echo
  cancelling), mono, on every browser and the iPhone app; opening it pauses
  any voice message that plays. When the last Take was recorded through a
  Bluetooth mic (earbuds, a headset, by the name the browser gives it), one
  more line in the same small grey sits under **Getting your mic ready**:
  **Earbuds make you sound like a phone call. The built-in mic sounds like
  you.** Signed in the Claude Code chat, 3 November 2026. Lives in
  `src/hooks/useDualCaptureMic.ts`, `recordingCopy.ts` and `LabOverlay.tsx`.
- **2026-11-04 · an answer to someone's Take follows the Take's own slides
  (backend N493 item 1, N504).** Step 6 for an answer to a Take sent to you:
  the recording screens show the Take's slides, in order, drawn by their
  titles as the poster (N462) with no "{name} asks" over them and no helper
  words (the sender's come from their Ideal Text, N479 item 8); Back and
  Next slide move through them as on any Take, Finish take on the last. The
  top line is **{name} · Slide n of m** in the usual small grey (was the
  name alone, N441 item 7). The clock counts up, no cap (N486 item 4). An
  answer to a customer's question keeps its one slide, **{name} asks** over
  the question, and the name alone in the top bar. A Take whose words are
  not processed yet has no slide titles to give, so its answer is the one
  slide, the Take's topic. Signed by the founder in the Claude Code chat,
  4 November 2026, on the prototype "The Official Inquiry"
  (<https://claude.ai/artifact/R3dPycpjHvgZ8sJHKpWFau>): "Go with all your
  recommendations". Lives in `LabOverlay.tsx` (`answerLook`,
  `RecordingWhere`), `recordingCopy.ts` (`answerWhere`) and
  `src/lib/willab/chatAnswer.ts` (`answerDeck`).
- **2026-11-09 · the browser's own leave warning (N553 item 1).** While a
  Take is recorded and until its upload is accepted, refreshing or closing
  the page in a browser shows the browser's own leave warning, in its
  words, never ours; iPhone Safari and the app ignore it, item 2 is for
  them. It starts with the recording (a call's pause and Finish take's last
  second included) and ends when the server answers that it has the Take
  (201 or 202). A failed upload keeps it until the Take goes up; "Discard
  this take?", or leaving these screens, ends it. Nothing else asks: not
  the set-up, the wait once the server has the Take, the Ideal Text, the
  walk, a file picked with "Upload a recording", or a move between the
  app's own pages. Nothing on screen changes. Signed in the Claude Code
  chat, 9 November 2026 ("Both: A now, B next"). Lives in
  `src/components/willab/labLeaveGuard.ts` and `LabOverlay.tsx`.
- **2026-11-09 · a Take is kept on the device until the server has it
  (backend N553 item 2, N556).** At Finish, and only then, the Take is
  saved on the device once, beside its upload: never while recording, and
  the upload never waits for it. The copy is deleted as soon as an answer
  names the Take's session (accepted, a duplicate, a 504 with its
  session), when the speaker discards it, when the server refuses it for
  good (no speech, 400, 404, the project being deleted, too large,
  recording consent withdrawn), or after 7 days; any other answer (no
  connection, 401, 403, 429, 5xx, a 504 without a session) keeps it. A
  kept Take is sent again at the next open, when the connection comes back
  and when the app returns to the front, while the Lab is closed and no
  other Take is still landing, one at a time, oldest first: through the
  same upload and processing authorization, with the same upload key, so
  the server answers a repeat with `duplicate` and never makes it twice.
  It then shows as processing as any Take does (the processing view, the
  share chosen for it, its "Your Recording" line unless the thread already
  has one), and while it goes up the record button waits with its signed
  line **One moment — finishing your last take.** Not sent, and deleted,
  when a newer Take of the same project is already on the server (an
  older Take never becomes the Ideal Text, Never 5: a Take made after
  this one's Finish with another upload key, which the server names for
  each Take; a Take with this one's key is this very Take, sent again and
  answered `duplicate`), or when recording consent was withdrawn. Kept through a sign-out and
  sent only when the same person is signed in, never under another
  account; deleted when that person asks to delete their account. Answers
  and questions recorded in a chat, a picked file and a guest's Take are
  left out for now. No new words on screen; the privacy line comes with
  the next privacy version (N556 item 4). Signed in the Claude Code chat,
  9 November 2026: "Ship B; line in next version", "At Finish only, for
  now", "Yes, all of them". Lives in `src/lib/willab/takeOutbox.ts`,
  `src/lib/willab/takeResend.ts`, `src/components/willab/useTakeResend.ts`,
  `LabOverlay.tsx` and `Lounge.tsx`.
- **2026-11-09 · a tap waits, then goes (backend N560 item 3).** From the
  start of recording until the server has the Take, it is discarded, or
  these screens close (the window of N553 item 1's leave warning), a page
  that would load over the Take waits: a tapped push notification, a
  WillpowerLab link opening the app, or a guest's first Take opening its
  review once their sign-up finishes (the send itself goes ahead at once).
  When the window ends the page opens; when more than one was tapped, the
  latest. Outside the window it opens at once, as before. Nothing on screen
  changes. Signed in the Claude Code chat, 9 November 2026 ("Wait, then
  go"). Lives in `src/components/willab/labLeaveGuard.ts`
  (`whenNoTakeAtRisk`), `src/lib/nativePush.ts`, `src/lib/nativeLinks.ts`
  and `src/components/willab/PendingCoachSend.tsx`.


## 2. In flight

One line per piece of work: `item · what it is · the rules it touches · where it stands · PR`. The session
doing it fills its line in its PR and deletes the line when the work is merged (the change goes to §6).

- **The plan's two touches on the set-up** · the topic arrives filled in from the plan's voice message (backend N141); "How do you feel?" shows before every practice between a plan's first and last, and the stress and readiness ratings take its place on those two (backend N151, N157) · the set-up's first question and the feelings check · built, on for ring 5 since 27 October 2026 (N203, N204, backend #1394): "Start your first recording" opens the set-up with the topic filled in and no feelings check; with an active plan, every later Take opens "How do you feel?" first, with a Skip (a new project's first Take shows it with a Skip too, N211), only after the plan's own yes (N217) and only for a signed-in speaker (N272), then the project's stored setup · rules: [`the-plan.md`](the-plan.md) §1 B7, D

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
- `src/components/willab/ProcessingWait.tsx` — the wait's stage and percent (step 5) (guarded since N111).
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
- <https://claude.ai/artifact/Ta5hMGw8EbA6ewUssUugMK>
- <https://claude.ai/artifact/S66ZsrqTQZ4se74caoCj2J>
- <https://claude.ai/artifact/6AVcGS1ksx86KzvUPyKEes>
- <https://claude.ai/artifact/6L2C5Uj7AiJbRaES4cxzb1>

## 6. Changes

One line each, newest first: `date · N · what changed · PR`.

- 2026-11-09 · N560 item 3 · a tapped push notification, a WillpowerLab link opening the app, or a guest's first Take opening its review after sign-up waits while a Take is recorded or not yet on the server (N553 item 1's window), then opens once the server has it, it is discarded or the screens close, the latest tap only; the guest's send itself goes ahead at once (`labLeaveGuard.ts`, `nativePush.ts`, `nativeLinks.ts`, `PendingCoachSend.tsx`). Nothing on screen changes. Was: the page loaded at once and the Take was lost · BE N560 (#1822), FE (this PR)
- 2026-11-09 · N556 item 3 · a kept Take knows a newer Take of its project by the upload key the server now names for each Take (`upload_key` in `/v2/user/trainings`): one later Take with another key is newer, and one with its own key is itself. Was: a guess from how many Takes came after its Finish and whether one had its "Your Recording" line, which missed a Take from another device that lost its line. A server without the keys keeps the guess (`lib/willab/takeResend.ts`, `services/api/trainings.ts`). No new words · BE #1824, FE (this PR)
- 2026-11-09 · N553 item 2, N556 · a finished Take is kept on the device (IndexedDB) until the server has it, and sent again at the next open, when the connection comes back and when the app returns to the front, through the same upload with the same upload key; deleted once the server names it, on a discard, a refusal for good, a newer Take of its project on the server, withdrawn recording consent, an account deletion, or after 7 days (`lib/willab/takeOutbox.ts`, `lib/willab/takeResend.ts`, `useTakeResend.ts`, `LabOverlay.tsx`, `Lounge.tsx`, `accountDeletion.ts`). No new words. Was: a Take whose upload never finished (the app killed, the page refreshed, the connection lost) was gone · BE N553, N556 (#1818), FE (this PR)
- 2026-11-09 · N553 item 1 · while a Take is recorded and until the server answers that it has it (201 or 202), refreshing or closing the page in a browser shows the browser's own "Leave page?" warning, with no words of ours; a failed upload keeps it until the Take goes up, and a discard or leaving the screens ends it; iPhone Safari and the app ignore it, item 2 is for them (`labLeaveGuard.ts`, `LabOverlay.tsx`). Nothing on screen changes. Was: a refresh or a close lost the Take with no warning · BE N553 (#1818), FE (this PR)
- 2026-11-09 · N549 · "Record Take N" opens "How do you feel?" at once: no 0.4 s fade into it, and the check draws from the tab's last "authorized" while the Lab's own consent read runs; a pick or Skip starts the Take only once that read agrees, and a read that says otherwise puts the acceptance flow in front (`LabOverlay.tsx`, `LabEntryGate.tsx`, `useSignedIn.ts`, `processingAuthorization.ts`). No new words. Was: the Lab faded in over 0.4 s and waited behind a loader for the read, so the page under it showed for a moment · BE (N549 log), FE (this PR)
- 2026-11-09 · no rule changed · a bug fix: the wait's ✕ shows the chat landed on "Processing your recording", and the thread lands on that bubble whenever a Take's processing starts (`useLandOnProcessing` in `usePinThreadBottom.ts`, `Lounge.tsx`). Nothing on screen changes. Was: since the chat follows only a new message (2026-11-05), the bubble, which is not a message, could stay below the screen after the ✕, and looked gone · FE (this PR)
- 2026-11-05 · no rule changed · "Discard this take?" takes the keyboard: focus moves onto "Keep recording" (or "Cancel") as it opens, Tab stays on its two answers, Escape keeps the Take; closed, focus is not handed back to the ✕, so the next Space still turns the slide (N70.1) (`DiscardTakeDialog.tsx`, as `ProcessingResumeOverlay.tsx` does). Nothing on screen changes. Was: focus stayed behind the dialog, Tab reached the screen under it and Escape did nothing · FE (this PR)
- 2026-11-04 · N505 · the strip and the buttons under the slide keep 8px above, on each side and below (the Feedback walk page's J9); was 16px above and on the sides (`RecordingRoadmap.tsx`) · BE, FE (this PR)
- 2026-11-04 · N483 item 4, N498 · flow step 7, a question to someone: the default presentation, "To {name} · Slide {n} of 3" in the top bar, no feelings check, Finish take back to the chat with Sending and Undo, as an answer (`LabOverlay.tsx` `answerLook` and `RecordingWhere`, `recordingCopy.ts` `recordingWhere`, `lib/willab/chatAnswer.ts` `asks`) · BE N498 (#1733), BE (question route PR), FE (this PR)
- 2026-11-04 · N486 · an answer has no five-minute cap: its clock is any Take's, counting up with no planned length, and it ends only at Finish take (`LabOverlay.tsx`, `chatAnswer.ts`). Was (N441 item 2): the clock counted down from 5:00 and finished the Take by itself at 0:00 · BE (cap PR), FE (this PR)
- 2026-11-04 · N462 · the slide is the poster: the first Take's new questions, the default presentation and an answer's question are drawn centered, the label small and spaced, the question large and heavy, the hint quiet, no orange line (`pdfSlides.tsx` `PosterSlide`, `RecordingRoadmap.tsx` `stageLook`, `SlideStage.tsx`); tall when the Take has no helper words, the 16:9 box with them; an uploaded deck as itself; the Ideal Text, present mode and the walk unchanged. The first Take's five questions are the new ones, the old five still drawn for a project made before (`firstTake.ts`). Was: the question at the bottom with the orange line, the default deck on its colour artwork, "{name} asks" in a small line · BE #1694, FE (this PR)

- 2026-11-03 · N449 · the first Take's questions fill the slide's space down to the strip, their words at the bottom (small title, mark, question at 27px, the line under it), with five marks under the slide: this question orange, the ones done dark, the rest grey (`RecordingRoadmap.tsx`, `SlideStage.tsx` `tall`, `pdfSlides.tsx`), as the prototype "The first Take" v1 draws them; the real talk after it is that project's Take 2, "Take 2 · Slide 1 of 3": its set-up runs afresh instead of the five questions' setup, "New slides" under "Getting your mic ready", and its slides become the project's from that Take before it is sent (`LabOverlay.tsx`, N257); the set-up's slides step says "Skip for now" whenever no slides were added, the last step included (`RecordingSetup.tsx`). Was: the question in the 16:9 box at the top; the real talk a new project at "Take 1"; "Start recording" on that step when it was the last. Every other Take unchanged · BE #1679, FE (this PR)
- 2026-11-03 · N441 · an answer's top bar is the person's name alone and its slide reads "{name} asks" over the question in body size; its clock counts down from 5:00 and finishes the Take by itself at 0:00; with one slide, Finish take alone fills the row, no Back (`LabOverlay.tsx`, `RecordingRoadmap.tsx`, `SlideStage.tsx`, `pdfSlides.tsx`). Was: the name above "Take 1 · Slide 1 of 1", the question as the heading, a clock counting up past 5:00, a greyed Back · BE (N441 PR), FE (this PR)
- 2026-11-03 · N437 · a phone call during a Take pauses it, its clock and its slide timing, and it carries on after the call; nothing new on screen. Was: the Take ran on through the call, recording silence · FE (this PR)
- 2026-11-03 · N392 · "How do you feel?" before a later Take (the project's setup restored) draws two marks in its bar beside the ✕: this screen first and current, the Take second (`FeelingsCheckIn.tsx`). Prototype <https://claude.ai/artifact/ChbCQzEKiTNtxofatBKZ3o>. No new words. Was (N272): the ✕ alone, an empty space above the question · BE #1646, FE (this PR)
- 2026-11-03 · N372 · the earbuds line under "Getting your mic ready" when the last Take was recorded through a Bluetooth mic; opening the mic pauses any voice message that plays (`useDualCaptureMic.ts`, `recordingCopy.ts`, `LabOverlay.tsx`, `LoadingState.tsx`, `lib/willab/oneVoice.ts`). Was: no word on earbuds · BE #1622, FE (this PR)
- 2026-11-03 · N372 · the mic records the voice as it is: the browser's call processing (automatic gain, noise suppression, echo cancellation) is asked off, mono, on every browser and the iPhone app, for a Take and the walk's practise (`TAKE_MIC_AUDIO` in `src/hooks/useDualCaptureMic.ts`), as the pace mic already did. Nothing on screen changes. Was: `audio: true`, which turns all three on · FE #1167
- 2026-11-03 · N363, N334, N361 · flow step 6, an answer in a chat: the person's name above "Take 1 · Slide 1 of 1"; no feelings check; Finish take goes back to the chat ("Sending to {name}…", Undo), the screens hidden while the Take uploads and shown again only for its error; no wait screen, no walk, no carried project, no community share (`LabOverlay.tsx`, `lib/willab/chatAnswer.ts`). Was: every Take ended in the processing wait and the walk · BE #1611, FE (this PR)
- 2026-10-29 · N271, N273 · the calm wait: "While you wait" and its slider of advice go; one narrow column with the breathing mark a little larger, the stage and its percent, a rounded bar and "Usually about a minute." under it (`RecordingAnalysisPresentation.tsx`; the tips' modules are deleted). Prototype <https://claude.ai/artifact/S66ZsrqTQZ4se74caoCj2J>. Was: the stage line, a 3px bar and "While you wait" with a scrollable deck of advice · FE (this PR), BE (N271, N273 log)
- 2026-10-29 · N273 · on Take 1, "WillpowerLab uses the microphone to record your Takes." under "Getting your mic ready" while the browser asks (`recordingCopy.ts`, `LabOverlay.tsx`). Was: the browser's prompt with nothing saying why · FE (this PR), BE (N273 log)
- 2026-10-29 · N272 · "How do you feel?" takes the set-up's look: its dots and ✕ (the check is the first of four when the set-up follows, then the topic is the second; the ✕ alone when the setup is restored), its heading with the mic, "Before you step on stage" under it, the four feelings two by two and Skip under Calm in the same pill, faded. The pick shows, then the set-up opens half a second later, with nothing said back. No "Your coach sees your answer." A guest is never asked (`FeelingsCheckIn.tsx`, `LabOverlay.tsx`, `RecordingSetup.tsx`, `wizard.tsx`). Prototype <https://claude.ai/artifact/CiCCZEE4rp7TfeVjfdnj1A>. No new words. Was: the overlay's ✕ above a 20px heading, four pills in a row, a reply line for a second, Skip as a text link, the coach line, and guests asked · BE #1501, FE (this PR)
- 2026-10-29 · N260 · Will's "Create new project" in the chat asks "One project at a time" first, in place of the message box, and the question's sentence ends "you can bring it back from Settings." Was: the chat's button started a new project with the current one left open, and the sentence said "Data & consent" · FE (this PR), BE (N260 log)
- 2026-10-29 · N254, N257 · built: the "+"'s "Start a new project", or another project than the one with the newest Take, asks "One project at a time" first and Continue archives the current one (`ProjectPicker.tsx`); the line under "Getting your mic ready" says "New slides" on the first Take after a deck change, then "Same presentation as Take {n}" (`presentationInPlay.ts`, `LabOverlay.tsx`). Was: any number of projects side by side, and always "Same presentation as Take 1" · FE (this PR), BE (with it)
- 2026-10-27 · N217 · "How do you feel?" says "Your coach sees your answer." under "Before you step on stage" (signed with Privacy 3.9, question 1 A: answering is the yes for that one answer); on a plan it is asked only after the plan's own yes, and without it the check is passed by at once and keeps nothing, as a Skip (`FeelingsCheckIn.tsx`, `plan.ts`). The plan's yes is switched off (`PLAN_CONSENT_ENABLED`) until Privacy 3.9 is published, so today every plan reads as yes. Was: asked of every speaker with no word on who sees it · FE (this PR), BE (with it)
- 2026-10-27 · N211 · "How do you feel?" has a Skip wherever it shows, a new project's first Take included (`FeelingsCheckIn.tsx`); skipping keeps no feeling. Was: a Skip only between a plan's first and last practice · BE #1408
- 2026-10-26 · N151, N178, N203 · with an active plan, "How do you feel?" comes before every Take but the plan's first, with a Skip (`FeelingsCheckIn.tsx`, `useWillabFlow.ts`); the plan's first Take opens the set-up with the topic filled in. Was: once per new project, before Take 1, no Skip · BE #1386, FE #1018

- 2026-10-26 · docs audit · the pointer to CLAUDE.md's "Design lock" section names its history copy; no rule changed · —
- 2026-10-23 · N116 · the screen stays on while a Take records; the Take's audio is kept in one-second pieces and an empty recording is never sent (it is asked for again) · BE #1268, FE #942

- 2026-10-21 · N111 · the page also guards the recording screens' files it missed: the discard dialog, the wait while a Take is processed, the slide and the fade (§4); no rule changes · BE, FE
- 2026-10-21 · N110 · the flow, 5, in the present tense: the wait starts at 1% and stays on screen through the hand-over to the Lounge until the walk's first step is on screen, in place of "the processing wait as today (voice mark, stage label, **While you wait** tips), then the Ideal Text page" · FE #931, BE #1245
- 2026-10-21 · N107 · this page replaces backend `FOUNDER-LOCK-recording-screens-2026-10-07.md` as the place the rules live; the lock stays as history · BE #1241, FE #928
