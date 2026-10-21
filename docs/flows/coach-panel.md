# The coach panel

One page for the coach's side: the Lounge door, the queue, a speaker, the
blind Judge, what happened, the diagnosis, the cure, the coach's words and
video, the share, the Summary, the word for a Take, the training corpus,
and the founder's rows. Started 2026-10-20 from the lock it replaces
(backend `FOUNDER-LOCK-coach-panel-redesign-2026-10-06.md`, with its
amendments of 2026-10-19 and 2026-10-20) and the panel's entries in the
decisions log, edited to the present. The lock file stays as history and is
no longer edited. It works like `feedback-walk-and-chat.md`: §1 is the
present, a change is a line, the design-lock check refuses a change to a
file in `scripts/flow-pages.txt` without this page.

The panel takes the Feedback walk's look and motion (that page, J): the
full-screen overlay, the grey profile picture, one player, the same moves
between screens. Two rules always hold: the coach's Judge stays blind
(nothing about the moment is fetched until the coach answers), and the
founder's rows are the founder's alone.

---

## 1. The rules

### A · One action per screen

- **A1** Buttons with different jobs never look alike. Every list of
  choices is cards: white with a thin edge, black text, no grey text inside
  a choice (2026-10-20; the lock's "white to darker grey" shading is
  history). One step per card; a choice moves on by itself and ‹ comes back
  to change it.
- **A2** On a computer, closing slides the grey and the panel off together,
  no strip left (#838).

### B · The door and the queue

- **B1** In the Lounge the bubble "N speakers waiting · Open your queue"
  opens the queue. Two buttons pinned above the message box, with icons:
  **Speakers** (every speaker, an orange dot on those waiting) and
  **Training corpus**.
- **B2** Your queue: your speakers only, the one who sent most recently on
  top, each a card with how many moments wait and an orange dot; an answered
  speaker drops out (2026-10-18). Every card is white; the dot says
  something is new (#871).
- **B3** Below: "Also waiting · blind": *Do you hear it?* and *Pick the most
  confident moment* (both built, switched off). The training corpus is not
  in the queue.
- **B4** The founder only, under the blind lists, in its own section "Will ·
  only you": "Will's questions" with "N questions · M empty slots", a
  chevron, no dot (N83). It opens Will's questions after a Take in the
  groups Will picks them by ("Who it's for", "What they should do", "When
  something is off", "Deeper, from Take 3"), each card with when Will asks
  it, the question, its tap answers (or "Their own words") and "Asked N
  times". Tap a question or an answer to change it, then the panel's black
  "Save"; the toast says "Saved". "Only you see this. Will asks the new
  words from the next Take." An "Empty slot" card opens with "+ Add a
  question". The words are checked before they are kept (no numbers, the
  speaker's own words kept in place, the same number of tap answers); a
  refusal says what is wrong above Save.
- **B5** The founder only: the ⋯ on a waiting speaker's card (on the card's
  left edge; the greyed row waiting for its text has one too) deletes that
  speaker's waiting moments behind a confirmation (#877, #879); the ⋯ on a
  blind line clears what waits on it for the week (#880). Other coaches have
  none.

### C · A speaker

- **C1** The speaker's pseudonym as the title; never a name, email or id.
- **C2** Under it, in one small grey line: "Goal: …", their profile goal
  when they have one.
- **C3** Under the goal, in the same small text, the speaker's own words
  from the newest Take that says so: "Who it's for: …" and "What they should
  do: …" (the setup's audience and its call to action, filled by Will's
  questions, N82). Nothing shows when the speaker has not said (founder,
  2026-10-20, N87, on the prototype in §5). The labels are the signed group
  names of B4; no new words.
- **C4** Their Takes, newest first, each a card: "Take N" and "{n} of {m}
  moments waiting" with the dot; under "Answered", faded, the Takes with
  nothing left ("All moments answered" / "Answered · {n} moments"), most
  recently answered first. Tapping a Take opens its first open moment; the
  newest answered Take opens on its Summary. A Take still waiting for its
  text is listed, never absent (2026-10-01).
- **C5** The Speakers button lists every speaker this coach may hear, at
  once from the queue's own speakers, then the fresh read (`/v2/coach/
  speakers`), with their goal, what waits and which Takes are answered.

### D · Judge this moment (blind)

- **D1** The player, the question "Does the speaker sound confident here?",
  the answers 👍 Yes, 😐 In-between, 👎 No, large and full width, and the
  small "Audio unclear". Nothing else: no passage, no kind, no machine read,
  no slide, no orange "Private · training" line. The bar reads "{pseudonym}
  · moment 1 of 4"; ‹ › move between moments; the counter counts moments
  only.
- **D2** It moves on by itself. The moment's read (the passage, the kind,
  what the machine heard) is fetched only after this coach's rating saves
  (Never 2). A moment this coach reported as Audio unclear goes to another
  coach; a quarantined or settled one asks nobody new.
- **D3** Only moments the speaker was shown (opened or skipped) or answered
  are listed (N48.2 Q1 A). Every moment the walk shows reaches the queue
  (`coach_moments_queue.reach_alarm`).

### E · What happened, the diagnosis, the cure

- **E1** What happened: the passage with its player; the lines: You, the
  speaker, The machine heard, and last **Willfidence** with the moment's
  willfidence in whole percent (the coach's only number; none when the clip
  has no sound read; founder 2026-10-21, N104).
- **E2** Error moments, the diagnosis first: "What kind of error is it?" The
  errors the machine heard come first, marked "The machine heard this"; then
  the others; then "Something else · Name a new error" (light grey card) and
  "I don't hear an error" (darker grey card). *Name the error*: one field
  ("A few words, as you would say it to another coach", "e.g. trailing
  off"); the exercise reaches the speaker now and waits in the library under
  that name until a detector can hear it. *I don't hear an error*: the
  answer becomes a note.
- **E3** The cure. For an error: **Choose exercise**, only exercises that
  treat the diagnosed error: Keep it (the served one, with Details), Swap it,
  Make a new one, Nothing to add. *Swap it* lists only exercises for that
  error ("All treat {error} · shown in random order", "Served now", each with
  Details), "Make a new one" at the bottom. *Details*: the video, its
  instruction, "Treats: {error}", "Use this one", "Back to the list". For
  praise, a clearer version or a note: "What will you do?" (Answer, Nothing
  to add).

### F · The coach's words, video and share

- **F1** Your words, as the speaker will see them: the speaker's passage and
  player on top, the coach's words below beside the grey-blue coach avatar
  (as speakers see the coach; N80), a pencil in the top-right corner to edit
  every word. An empty words field stays open, so Next is never stuck
  (#874).
- **F2** Your video: Record, one action; "Say the instruction in your own
  words · under a minute"; optional. An error answered without a video goes
  to the speaker without the library: never stuck.
- **F3** Praise and clearer version: the kind question, "What did {p} do
  well?" / "What kind of fix is it?"; Skip shares without the library.
- **F4** Ready for {p}: exactly what the speaker will get; "Share with {p}"
  or "Share without the library". "Without a video it goes to {p} only, not
  to the library." "In the library under “{error}”, waiting until the
  machine can hear it." No "Keep it to this speaker" box.
- **F5** A coach's exercise video for a speaker is turned into words only
  when that speaker gave the training yes (N79); direct messages stay
  private.

### G · The Summary and the word for a Take

- **G1** An answered moment, reopened from the queue: what happened and
  "Your answer"; "Change my answer".
- **G2** A word for this Take, looking like the speaker's first screen, with
  the pencil; "Optional · it opens first in {p}'s feedback"; then its video
  step; Send. "Send without a video" sends the word with no video.
- **G3** Coming back to a Take word already sent, "Your video" shows the
  saved video with the coach's words under it: "Send to {p}" keeps it,
  "Record again" replaces it, "Remove the video" returns to the camera with
  "Record" and "Send without a video". "Remove the video" shows only for a
  saved video, never right after recording a new clip; after it, going back
  and forward keeps it removed until Send; ✕ cancels and nothing is saved
  (N80). Every version of a Take word is kept; training reads the newest
  (N79).
- **G4** On the speaker's side the changed word is one "Later · from your
  coach" bubble, a taken-back video no longer plays, watched anywhere is
  watched (the walk's page, D5).

### H · The training corpus

How a coach's blind answer counts, on a speaker's Take (D) or an import
(H), and every other source the app learns from, is one backend page:
`docs/LEARNING-AND-QUORUM.md` (N102).

- **H1** From its pinned button: the list of imports ("{n} imports", "{n}
  moments to judge"); **Import audio** ("Choose a file", "Audio or video, up
  to 30 minutes", "One recording · it is cut into moments you judge blind");
  the set-up with the corpus page's own fields (what the talk is about,
  whose voice this is, what language it is in, where it came from, what to
  run); an import whose set-up is not finished opens the set-up before any
  judging ("Finish the set-up", "Set-up not finished · finish it before
  judging"); then its moments are judged blind on the same Judge screen
  (CO1 A). The delete confirmation opens as a full sheet (#869). The founder's
  erase of an import works on production's tables and never deletes from
  the read-only detector reconciliation (#1172, #1173).
- **H2** Import audio takes several files at once (2026-10-21): each becomes
  its own import under the same set-up, imported one at a time in name
  order, filed as "{topic} · {file name}" so the list tells them apart (one
  file keeps the topic as typed). The row says "{n} files"; the loader says
  which file is on its way, "{name} · {i} of {n}". It stays inside the
  backend's upload limit (20 a minute, 200 an hour per coach): more than 200
  files is refused at the choice ("Up to 200 files at a time"), a per-minute
  refusal is waited out, an hourly one stops the batch. What did not import
  is named under the pill with the backend's sentence.

- **H3** The corpus is judged mixed (2026-10-21, N101; it replaces judging
  one import after another, N99): opening an import starts rounds of clips
  across every open import the coach may hear, the first with a clip of the
  opened one; never one speaker twice in a row while another is left; up to
  the same number of clips from each band of the machine's read (high,
  neutral, low), so all three are there. The band decides only which clips
  come in, never where they stand: the order is a seeded shuffle, nothing on
  screen hints at the machine's read (BLIND COACH). The judging screen names
  each clip's recording by its topic. An answer moves on at once while its
  save runs behind it; a refused save brings the coach back to that clip
  with the backend's sentence, or says it on the panel once the judging is
  left. After a round, once its saves are in, the next round; when nothing
  is left, the list. In the list the done imports sit at the bottom. No new
  words.
- **H4** The list comes in steps (2026-10-21, N100): the newest 50 imports
  first; reaching the bottom reads the next 50, the app's one loader showing
  until they land. The list is no longer cut at its newest 200. No new
  words.

### I · Library and speaking errors (the founder's admin)

- **I1** Both left the coach's app for the founder's admin area, next to the
  pace panel (CP3 A): "One error · the library offers it when the machine
  hears it", "As a speaker will see it · the pencil edits every word", "An
  exercise needs its video", "Bring it back", "Retire it", "Praise lines the
  library offers when the machine hears this", "None yet.", "Exercises that
  treat it". In the moment, coaches already make, choose and name everything
  they need.

### J · Words on screen (all signed, CP2 A)

- Queue: "Your speakers · {n} moments waiting"; "Your queue"; "Nobody is
  waiting for you."; "Open your queue"; "Speakers"; "Training corpus"; "Also
  waiting · blind".
- A speaker: "Goal: …"; "Who it's for: …"; "What they should do: …" (the
  labels from N83, in this place from N87); "{n} of {m} moments waiting";
  "All moments answered"; "Answered"; "Answered · {n} moments"; "Waiting for
  the text"; "Take N".
- Judge: "Judge this moment"; "Does the speaker sound confident here?";
  "Yes", "In-between", "No", "Audio unclear"; "{p} · moment 1 of 4".
- What happened: "What happened"; "You"; "The machine heard"; "Willfidence".
- Diagnosis: "What kind of error is it?"; "The machine heard this";
  "Something else"; "Name a new error"; "I don't hear an error"; "Name the
  error"; "A few words, as you would say it to another coach"; "e.g.
  trailing off"; "Your exercise goes to {p} now. The library offers it to
  other speakers once the machine can hear this error; every coach who names
  it brings that closer."
- The cure: "Choose exercise"; "What will you do?"; "Served: {exercise}";
  "{n} more for {error} in the library"; "Your own words and video"; "Write
  your praise"; "Write a clearer version"; "Write a note"; "All treat {error}
  · shown in random order"; "Served now"; "Treats: {error}"; "Details";
  "Back to the list"; "Use this one".
- Your words and video: "As {p} will see it · the pencil edits every word";
  "Say the instruction in your own words · under a minute"; "Optional · under
  a minute".
- The kind question and the share: "What did {p} do well?"; "What kind of
  fix is it?"; "Ready for {p}"; "Share with {p}"; "Share without the
  library"; "Without a video it goes to {p} only, not to the library."; "In
  the library under “{error}”, waiting until the machine can hear it."
- Summary and the Take word: "Your answer"; "Change my answer"; "A word for
  this Take"; "Optional · it opens first in {p}'s feedback"; "Send"; "Send
  without a video"; "Send to {p}"; "Record again"; "Remove the video" (N80).
- Will's questions (N83): "Will · only you"; "Will's questions"; "N
  questions · M empty slots"; "Only you see this. Will asks the new words
  from the next Take."; "Empty slot"; "Add a question"; "Their own words";
  "Asked N times"; "Saved".
- Training corpus: "Import audio, label it, then judge its moments blind";
  "{n} imports"; "{n} moments to judge"; "{n} of {m} moments to judge"; "One
  recording · it is cut into moments you judge blind"; "Choose a file";
  "Audio or video, up to 30 minutes"; "Imported · {n} moments"; "Finish the
  set-up"; "Before its moments can be judged"; "Set-up not finished · finish
  it before judging"; "Set up"; "{n} moments"; "{n} files"; "{i} of {n}";
  "Up to {n} files at a time".
- Library (admin): the lines in I1.
- **Signed, no longer shown** (kept so they are not reused unsigned): "Your
  diagnosis first; the exercise comes next"; "Your diagnosis: {error}";
  "nothing in the library treats it yet"; "You don't hear an error"; "So the
  library can offer it to the next speaker"; the orange "Private · training"
  line; "Not sure" (judging moved to three answers, 2026-10-12).

---

## 2. In flight

One line per piece of work: `item · what it is · the rules it touches ·
where it stands · PR`. The session doing it fills its line in its PR and
deletes the line when the work is merged (the change goes to §6).

- (nothing in flight)

## 3. Still open

- **"Do you hear it?" and "Pick the most confident moment"** are built and
  switched off (B3); switching them on is the founder's call.
- **A later change of the coach's word updates the in-review bubble in
  place** on the speaker's side (the walk's page, D5): a backend follow-up,
  not built.
- **The coach panel showing more of Will's knowledge** (the speaker's
  private note) is not asked for; the founder reads it on the person's admin
  page.

## 4. Where it lives

Frontend, guarded by `scripts/flow-pages.txt` (a change must change this
page):

- `src/components/willab/coachpanel/` — the panel: `CoachPanel.tsx`,
  `CoachPanelDoor.tsx` (B1), `CoachPanelScreens.tsx` (the queue, a speaker
  with `speakerLines` and `talkSetup`, the Judge, what happened, the
  Summary), `CoachAnswerFlow.tsx` and `CoachAnswerScreens.tsx` (E, F, G),
  `CoachWords.tsx`, `CoachVideoBox.tsx`, `CoachCorpusScreens.tsx` and
  `CoachCorpusJudge.tsx` (H), `V4BlindSheets.tsx` (B3), `WillBankScreen.tsx`
  (B4).
- `src/components/willab/coachwalk/` — the coach's walk from the Lounge:
  the bubble, the entry, the blind Judge sheet, the moments queue hook.
- `src/lib/willab/coachPanelCopy.ts` — every signed word (J).
- `src/lib/willab/coachWalk.ts` — the queue's shape, the state words, where
  the walk goes next; `mapMomentsQueue` reads `audience` and
  `call_to_action` per Take (C3).
- `src/services/api/coachSpeakers.ts` — the Speakers list (C5) and the
  queue's speakers as the list draws them.
- `src/app/admin/library/`, `src/app/admin/errors/` — the founder's Library
  and Speaking errors pages (I).

Frontend, shared (not guarded): `src/components/willab/walk/WalkOverlay.tsx`
(the overlay the panel's screens use; its `subtitle` takes several lines),
`src/components/willab/Lounge.tsx` (the door's bubble and pinned buttons).

Backend (`wilplus/backend-cursor`): `services/coach_moments_queue.py`
(the queue, `talk_setup`, `reach_alarm`), `services/coach_speakers.py`
(C5), `services/coach_moment_read.py` (D2), `services/coach_message_read.py`
(G2), `services/coach_listen_again.py` (D2), `services/will_question.py`
(B4's bank, `admin_view`, `save_bank`), `routes/v2/coach.py`
(`/v2/coach/queue/moments`, `/v2/coach/speakers`), `routes/v2/people.py`
(`/v2/admin/will-questions`).

Tests that hold the promises: `src/components/willab/coachpanel/coachPanel.test.tsx`,
`coachPanelCorpus.test.tsx`, `v4BlindSheets.test.tsx`, `willBank.test.tsx`,
`src/components/willab/coachwalk/coachJudgeSheet.test.tsx`,
`coachWalkBubble.test.tsx`, `src/lib/willab/coachWalk.test.ts`; backend
`tests/test_coach_blind_gate.py`, `tests/test_coach_reach_alarm.py`,
`tests/test_coach_founder_closes_moments.py`, `tests/test_coach_queue_talk_setup.py`,
`tests/test_will_question.py`. Every test's story: `docs/TEST-STORIES.csv`.

## 5. Prototypes

The design is the prototype; the newest wins where two disagree.

- **Current:** who the talk is for and what they should do, under the goal
  <https://claude.ai/artifact/UiZzNZs5623NkforaeR4PM> (N87, 2026-10-20);
  Will's questions <https://claude.ai/artifact/WLZ1KY6dX1RBLXiNU73F9N> (N83);
  the saved video, Record again, Remove the video
  <https://claude.ai/artifact/APk56PLZt6o6Cx9qUMKkuk> (N80).
- **The base:** the coach panel, redrawn
  <https://claude.ai/artifact/TEBvGMehRF6wXCvJTEYTUA> (2026-10-06, locked
  2026-10-07, N57); a copy as locked in backend
  `docs/design/coach-panel-redesign-2026-10-06.html`.
- **History:** the panel before the redraw
  <https://claude.ai/artifact/DcezJeY9JFsuLkB6jn8asV>.

## 6. Changes

One line each, newest first: `date · N · what changed · PR`.

- 2026-10-21 · N104 · What happened gets a last line, Willfidence, in percent; the person's admin page loses the Confident Voice practice tile (E1) · FE #923, BE #1236
- 2026-10-21 · N102 · H points to the one page for learning and the label quorum (backend `docs/LEARNING-AND-QUORUM.md`); no rule changes · FE #922, BE #1234
- 2026-10-21 · N101 · the corpus is judged mixed: rounds across imports, never one speaker twice in a row, the machine's reads in equal measure, a blind order (H3) · BE #1232
- 2026-10-21 · N100 · the training corpus list comes in steps as the coach scrolls (H4) · BE #1229
- 2026-10-21 · N99 · judging goes on from one import to the next, done imports at the bottom, an answer moves on while it saves (H3)
- 2026-10-21 · N96 · Import audio takes several files, one import each, inside the backend's upload limit (H2) · FE #913, BE #1218
- 2026-10-20 · N87 · this page replaces the lock file; the speaker's screen shows who the talk is for and what they should do under the goal, in the same small text (C3, J) · FE #895, BE #1208
- 2026-10-20 · N83 · the founder edits Will's questions on the coach panel, one row under the blind lists (B4) · FE #887, BE #1197
- 2026-10-20 · the founder's ⋯ clears what waits on a blind list for the week (B5) · FE #880, BE #1185
- 2026-10-20 · every card white, an orange dot when something is new (A1, B2) · FE #871
- 2026-10-20 · the founder's ⋯ deletes a speaker's waiting moments; the ⋯ on the card's left edge, the greyed row has one (B5) · FE #877, #879; BE #1179, #1182
- 2026-10-20 · an empty words field stays open, so Next is never stuck (F1) · FE #874
- 2026-10-20 · the coach's practice gate reads the speaker where their own page does: no "The speaker turned practice off" for an older Take under an earlier principal · BE #1206
- 2026-10-20 · on a computer, closing slides the grey and the panel off together (A2) · FE #838
- 2026-10-20 · the delete confirmation opens as a full sheet in the corpus list (H1) · FE #869
- 2026-10-19 · N80 · coming back to a sent Take word: the saved video, Record again, Remove the video; the coach's grey-blue avatar (F1, G3) · FE #861
- 2026-10-19 · N79 · a coach's exercise video is turned into words only with the speaker's training yes; every Take-word version kept, the newest teaches (F5, G3) · BE #1133–#1138
- 2026-10-18 · the queue puts the speaker who sent last on top; an answered speaker drops out; the speakers' goals from one batched read (B2, C2)
- 2026-10-12 · the Judge's answers become 👍 😐 👎 and "Audio unclear"; "Not sure" goes (D1; the walk's lock, section 7)
- 2026-10-07 · N57 · the coach panel's design locked to the prototype
- 2026-10-06 · N56 · the coach panel redrawn (CP2 A words, CP3 A library and errors to admin, CO1 A the training corpus switched on) · <https://claude.ai/artifact/TEBvGMehRF6wXCvJTEYTUA>
