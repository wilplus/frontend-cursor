# The Feedback walk and the chat

One page for one loop: a Take is processed → the lens opens on the walk →
the Ideal Text page → the Lounge chat, the Take's one ask and the summary →
the next Take. Started 2026-10-20 from the two lock files it replaces
(backend `FOUNDER-LOCK-feedback-walk-2026-10-06.md` and
`FOUNDER-LOCK-moment-feedback-chat-2026-10-12.md`) and the walk's entries
in the decisions log, edited to the present. Those files stay as history
and are no longer edited.

**How this page works**

- **§1 is the present.** A rule that changes is rewritten in place; its old
  wording goes to §6 as one line. Never a new file.
- A new feature, fix or amendment is **a line in §1, §2 or §6.**
- Who said it and when is a suffix in brackets, not a paragraph.
- **The prototypes are the design** (§5); this page is their written record
  and the check when something is built. Where they disagree, say so in §3.
- A frontend commit that changes a file in `scripts/flow-pages.txt` must
  change this page too; the design-lock check (`npm run check:design-lock`)
  enforces it. A backend PR that changes a rule here names the frontend PR
  that updates the page.
- The decisions log (backend `docs/SPEC-DECISIONS-LOG.md`) keeps its
  N-numbers; an entry for this flow is two lines and a link here.
- No new words on screen without the founder's OK: every word is in §1 K.
- Every other locked screen (the coach panel, the recording screens, the
  consent screens, the Ideal Text's own lock) gets a page of this shape the
  next time it is changed: that PR folds its lock file into
  `docs/flows/<screen>.md` and adds its files to `scripts/flow-pages.txt`
  (founder, 2026-10-20).

Three rules that always hold: the coach's Judge screen stays blind; the
recording screens keep recording, saving and processing working at every
step; the loop never waits for a coach.

---

## 1. The rules

### A · After a Take

- **A1** While the Take processes, the chat shows "Processing your
  recording" with the typing dots (dots in place of the breathing mark,
  2026-10-20). The bubble stays until the Take's text and its marks are
  stored: the marks are baked in the processing run right after the Take
  is ready, and the page asks for them until they are in (or for ninety
  seconds), so the walk opens the moment the bubble ends (2026-10-20,
  WIL-76).
- **A2** The moment processing finishes, the walk opens, right away, with
  nothing in between; the waiting screen before it stays as it is (founder,
  2026-10-20, first review of this page). The Ideal Text shows only once the
  page knows there is nothing to walk. The eight-second last resort counts
  only once the page has loaded, its marks are in and its deck is up. The
  page asks for late marks until its ninety seconds are up and then says
  so; it never holds its slot open without asking (2026-10-20, WIL-76: the
  typing dots that never ended).
- **A3** The loop never waits for a coach (2026-09-16, 2026-09-26). The
  coach's word opens the walk only when it is there.

### B · One chat, two views

- **B1** One thread, stored once: the Lounge thread (`lounge_messages`,
  kind `walk_step`). Every step is a message with one author: the speaker,
  the app (line bank), the coach, the rewrite (LLM) or the summary (GPT-4o).
  Nothing is copied. An old step seen again is stored once.
- **B2** Lens on is the walk: the same messages as one chat that grows by
  taps, full screen, 18.5px text, 22px corners, 22px avatar, ‹ › and ✕ in
  the bar, no message box, no scrollbar (wheel, trackpad or finger). On a
  computer the lens is as wide as the Lounge's chat column (max-w-3xl); the
  Ideal Text's Record Take and Close sit in the same column (2026-10-20).
- **B3** Lens off is the Lounge, the main view: the same steps as chat
  bubbles, 15px, 16px corners, 20px avatar. A step that asks is a message
  with controls; answered, it locks and keeps the answer, which also shows as
  the speaker's own bubble. The Lounge has no record button, only the
  message box.
- **B4** Bubbles: the speaker orange on the right; the app and the coach
  light grey on the left with a small avatar (the coach's grey-blue). No
  bold in any bubble. No sender labels, except "Your coach:" which opens the
  coach's bubble, with the colon (2026-10-20).
- **B5** Nothing swaps. Each step reached lands under the one before;
  earlier steps stay above to scroll back to; nothing leaves the thread while
  the lens is open. The newest step comes to the top: its name moves to the
  top of the thread and its bubbles land under it; a step taller than the
  thread follows down to its newest bubble (2026-10-20, replacing N81's
  "scroll to the bottom").
- **B6** Each step opens with its name as a small line ("Slide 2", "Slide 2
  · helper words", "Take 2", "Your coach"). The bar shows the step in view;
  ‹ › scroll to the step before or after, within this opening of the walk.
- **B7** The step's buttons are a dock under the thread. A choice lands as
  the speaker's orange bubble, in the words the Lounge stores; the next
  step's bubbles land one after another, each grey one behind the typing
  dots, 350 ms a bubble (the Lounge's beat, 2026-10-20), and its buttons once
  they have all landed. Next and Continue post nothing.
- **B8** The typing dots are the only wait, in the lens and the Lounge: a
  bubble being written, a try checked, other speakers' moments or the summary
  loading, the thread loading, the processing bubble. No breathing mark.
- **B9** Scrolled back to an answered step, the buttons read Next, which
  brings the newest step back; the recorder never gives way.
- **B10** From the Lounge, a bubble with › opens that Take's walk at that
  step ("✓ …" and Next for an answered one). A step still waiting has an
  orange outline, and "Continue review" shows above the message box until
  every step is answered. Answered steps are read only; an older Take's walk
  is read only and ends on that Take's Ideal Text. Every door opens the walk
  the same way (one mechanism, founder 2026-10-20, N89): the whole Take's
  walk, at the step the door names, live while that step waits (its own
  buttons) and as given once answered (read only; the helper words still
  editable on the latest Take, F3). A bubble whose name is not a step of the
  walk (a coach's word on a moment, a clip, a try's answer) opens on its
  moment's step. Opened on a step already answered past, the walk shows
  that step first, with the parts before and after it there to scroll, and
  the newest part at the end with the dock (founder 2026-10-21: "the WALK
  opens up immediately on that part of the WALK, but you can scroll to
  previous parts or scroll to the next ones").
- **B11** ✕ turns the lens off and goes back where the step was opened
  from: the chat, or the Ideal Text page for a step opened from a paragraph.
  ✕ keeps a coach word's "new" ring.
- **B12** The Lounge says the same words as the lens: the practise answer's
  line as shown, no "Practise" or "Practise again" bubble of its own, and
  "Slide 2" above a moment (N81).

### C · The walk, in order

- **C1 Your coach.** First, if there is one: "Your coach:", the coach's
  bubble (video or words only; everything the coach sent), then "Continue".
  Only this Take's coach word opens it (2026-10-20, narrowing N48.3 Q11 A):
  an earlier Take's word served in its place stays in the Lounge as the
  coach's bubble and neither opens Step 0 nor keeps "Continue review" up.
  The coach's own doors (the WhatsApp and email links, the dot card, the
  coach's bubble in the chat) open the walk at the coach's place: Step 0 for
  a general word, the moment's step for a word on a particular moment (one
  mechanism, N89, 2026-10-20).
- **C2 Praise.** The Take's two highest-willfidence moments are shown,
  praise first and then the corrections, each group in slide order, and the
  score decides each: a moment at or above the floor is
  praised, one below it is corrected (C4); both strong, two praises and no
  practise; both weak, two corrections (founder, 2026-10-20, on the page's
  first review; the fixed roles of 2026-10-14 and 2026-10-17, the highest
  praised with the softer line under the floor and the second highest
  always corrected, are history). A praised moment:
  its clip as the speaker's orange bubble; on the highest moment the line
  "This was your most confident moment." (signed 2026-10-20; "This was
  your most confident moment so far." opens its clearer version or
  Exercise when that moment is corrected); then the opening line by its level (W1–W10, three signed lines
  a level, rotated; the cue line under it; `src/lib/willab/praiseLevels.ts`),
  "Good job" and one line from B01–B09. Then "Next". Praise is never
  promised. A served moment with nothing attached is the moment said again,
  so the lens always has a step; with no moment at all the text shows.
- **C3 Choose your helper words**, after each praised moment: a big bubble in
  the thread with large plain word buttons, no borders, chosen words orange;
  "N of 6 words", "Use these helper words" and "Skip"; once the words are
  given, the pill reads "Edit the helper words" and the link "Keep these"
  (founder, signed 2026-10-21). Helper words stay
  editable from the Lounge's helper-words bubble and in the next Take's
  walk, on the latest Take only (rule 5); an older Take's words are locked
  ("🔒 Take N"). They come from a moment that sounded confident. Opened from
  the Lounge's helper-words bubble while the marks may still land, the
  picker waits for them, so it is the Take's step in the chat and not one
  screen on its own; only a paragraph with no moment opens on its own
  words (F5; 2026-10-20).
- **C4 Correction.** A shown moment below the floor is corrected (founder,
  2026-10-20; until then the second highest was always corrected and the
  highest never, 2026-10-14). It is never called weak. It opens on the Clearer version only
  when both gates pass (H3), else on the voice Exercise with the AI clip
  (words first, then voice, 2026-10-18, N76). Two weak moments mean two
  corrections, in slide order, each with its own tries and clips. The
  Clearer version is served on its moment (the row names the moment's
  block; until 2026-10-20 it did not, so the walk never drew it, "the
  rewrite doesn't appear at all"). A corrected moment with neither a
  clearer version nor an exercise is said again, never dropped (C2).
- **C5 The Clearer version.** The speaker's words with the changed words
  crossed out; "Here is a slightly more polished option:" (when the reason is
  undermining words, `rewrite_reason: "undermining"`, B10's "Say what you
  mean. Don't dance around it, just say it straight." and "Try saying it
  like this:" in its place, N85); the new text with the new words in orange;
  "Do you accept and want to practise it?";
  "Accept and practise" / "Keep my words" (which practises their own
  sentence with Line A). At most one rewrite per corrected moment. An accepted version
  never changes the Ideal Text (rule 5): it gets there when it is said in the
  next Take. After a try only the voice is checked, on the same lanes as the
  Exercise: better is the Good job and no clip; not yet brings the AI clip of
  the accepted words (or their own after "Keep my words") with L4, L3, then
  L5. A try with no sound read is a Good job. An answered Clearer version
  stays read only, in the walk and from the Lounge.
- **C6 The voice Exercise** opens with praise: L4 "That was good. But what
  if you said it more like this?", the AI version of their voice, then L3
  "Now try saying it like that." (N82). When a library video fits exactly
  and targets the chosen problem, the video and its instruction (the coach's
  when there is one, else Line A) take the clip's place, then "Practise".
  Under the clip's player one signed sentence says why (L14–L18). Without a
  clip the Exercise is as locked. The Exercise is one thread showing its
  whole history: the clip, the Exercise, every try and its answer
  (2026-10-16). The clip's own rules: backend
  `FOUNDER-LOCK-ai-voice-practice-2026-10-12.md`.
- **C7 Practise.** Every practise is one thread: the words to say, the
  recorder in the dock (the strip with the dot, the clock and the bar;
  "Skip" in the Back style and a red "Stop" in the Finish-take style), the
  try as the orange "Practise N", the typing dots while it is checked, then
  the answer. The recorder is the recording screen as re-locked 2026-10-12
  (N70) without the slide card; after Stop the walk returns instantly. The
  machine decides (H1): a Good job on the voice alone needs the margin,
  +0.05 (`after_practice.GOOD_JOB_MARGIN`, N84); a cleared problem, or a cue
  moved by at least half a within-speaker deviation, counts too; a clearer
  version's try with no sound read is a Good job; a smaller rise is a not
  yet. It never asks the speaker how it sounded. **Not yet:** a not-yet line that changes each time, the
  same AI clip with L5, and under it only "Practise" or "Practise again"
  with the red dot, no Next and no Skip, until a Good job or the third try
  (2026-10-18). **Better:** "Good job", "That sounded more assured than the
  first.", Next; a Good job ends the practise. At most three tries, then
  Next alone, with the signed move-on line when the third was not praise. A
  late answer offers Practise again while a try is left. A try the server
  could not hear (too short, no speech, not the passage, nothing to
  compare) is answered "We couldn't hear that clearly. Try again." with
  "Practise again" and "Next" (founder, signed 2026-10-21; until then it
  looked like a late answer with nothing said). The server still accepts
  tries after a praise; the app no longer offers them. Played again,
  a finished walk shows the thread and Next only: nothing is recorded there.
  Nothing else interrupts the practice.
- **C8 Other speakers**, once, after the practice: one moment per try, at
  least one and at most three; none if no shared clips exist yet. The first
  opens with Line B ("Now one moment from another speaker." / "Now N moments
  from other speakers.", or the community's name: "Now one moment from
  Invita."), the clip and "Does this sound confident to you?" in one system
  bubble, regular weight. The dock: 👍 Yes, 😐 In-between, 👎 No, large and
  full width; "Audio unclear" a small link. The voice only, never the words.
  An answer moves on by itself after 0.28 s and stays locked. Each lands
  with its name ("Other speakers · 2 of 3"); the bar reads "Other speakers ·
  1 of N" or "Invita · 1 of N". Who you judge follows who you share with
  (G3). An old judging bubble in the chat opens "Other speakers" afresh with
  new moments; no read-only replay, and no other speaker's recording is ever
  stored in a speaker's thread (2026-10-13).
- **C9 The closing summary** (D), then "Next", which opens the Ideal Text.
- **C10 No longer in the walk:** "Judgement time!", judging your own
  moments, self-judging a practice try (on hold, §3), "Not sure", and Will's
  question (it is the Lounge's, E2).

### D · The closing summary

- **D1** One plain bubble, two to four short sentences, by GPT-4o
  (`STRONG_MODEL`, backend `services/take_summary.py`) through the
  processing-authorization path. Cheeky and curious, like a colleague: "you",
  contractions, plain words, exclamation marks fine, one emoji at most; never
  "cue" or metric names; no numbers (a signed line's Take number aside),
  scores or verdicts; no cheerleading and no advice (the walk did). It
  speaks only to what the Take showed about whether they can do it, never to
  their self-esteem (2026-10-14).
- **D2** It knows the talk's title and slide topics, what the speaker said,
  their most confident moment, this Take's real progress against the last
  from the audio analysis, the practice result, the coach's asks, at most two
  helper words, what the speaker said in an older Take (#1184) and Will's
  private note on them (`services/speaker_memory.py`). Its praise is one
  signed line from `services/line_bank.py`, varied lightly at most; code
  checks the line is there and falls back to the signed journey copy. After
  Take 1 it claims no progress. It asks whether the talk matches its title
  only with curiosity.
- **D3** It ends on what the Take showed, never with a question and, since
  N89 (2026-10-20), without the next step and without the record button:
  the chain (D4) brings them.
- **D4** In the chat the review ends with the Take's small card (the first
  slide, the project's name, a version tag such as "2.0", the coach's "new"
  dot on the project's newest card) and the summary as a plain bubble that
  cannot be tapped. Then the chain, one action at a time, each after the one
  before is answered (founder 2026-10-20, N89): every ask that waits (E1),
  each opened by Will's lead-in line and followed by the ask's buttons; and
  only then "Look, practice makes perfect. If you're ready, let's go with the
  next take. 💪" with "Record Take N" under it (backend
  `services/after_take.py`). The closing message is held back while the
  chain runs. The ask and its buttons are adjacent: the card is moved above
  the Take's whole batch, the admin's asks included (2026-10-20: the card had
  landed between the data question and its buttons).
- **D5** A coach update arrives under "Later · from your coach", outlined
  in orange, at the bottom of the chat the moment the coach shares it, like
  a new message, whether or not the review has ended (founder 2026-10-21;
  until then a word shared during the review reached the chat only as the
  walk's copy, among the Take's steps): one bubble per Take word, moved to
  the bottom with the latest words and video, never stacked (N80). It
  rewrites the summary in
  place; "Updated with your coach's note · see / hide the earlier version"
  shows the summary from before any coach note (or the first summary, when
  it already heard the coach). A video-only change does not rewrite the
  summary; the same words and video again change nothing. The walk's own
  copy of the coach's word in the chat opens the same lens (C1: the coach's
  bubble is one of the coach's doors; 2026-10-20). A removed or replaced
  coach video no longer plays anywhere in the chat (the file stays
  stored). Watching the word anywhere clears its "new" marks, and the walk
  writes the coach's words into the chat only once; only "Continue" on the
  coach's step marks it watched. Tapping the bubble opens the walk at the
  coach's place (C1; N89, 2026-10-20: the word alone in its own lens with
  "Close", N80, is history). During the review a
  new or removed video with the same words makes the word new again (C1
  again); a later change updates the bubble in place. A coach update during a
  recording waits in the chat.

### E · The Take's one ask (backend `services/after_take.py`)

- **E1** After the summary come the asks that wait, one at a time, in this
  order (N89, 2026-10-20; until then at most one ask a Take). Take 1: Will's
  question when he has one, then "Did this help?" when the Take looks off.
  From Take 2: the CEO panel's ask, WhatsApp (at most twice), the home screen
  (once), Will's question, "Did this help?" when the Take looks off. Will
  opens WhatsApp, the home screen and "Did this help?" with a lead-in: one or
  two sentences tied to this Take (never a grade, never advice; "Well, I can
  see you're doing pretty good. What about adding the application to the
  screen within one tap?", "You can add your phone number, to know where,
  when you get the message." are the founder's examples), then the ask's
  signed words with a light touch, checked as E2's variation is (no number,
  the ask still said); Will's own question needs none, and the CEO panel's
  asks are drawn as written. "Yes" to "Did this help?" brings "We're glad it
  helped you.", then the next ask. A typed message passes the ask in front;
  "Not now" on the CEO panel's ask brings it back after the next Take
  (2026-10-20); an ask that no longer applies when its turn comes is
  skipped. These choices (the condition and place of "Did this help?", Take
  1's asks, which asks get a lead-in) were confirmed by the founder on
  2026-10-21. A distressed answer under "What would help?" gets the chat's
  safety reply (backend #1199).
- **E2** Will asks only when something is off or missing, once per Take,
  the first that holds (`services/will_question.py`, N82): a breather when
  the practice did not land or the voice dipped two Takes running (never two
  Takes running); "On purpose?" when the clearer line practised last Take
  did not come back (the practice's own passage match, no AI guess); who the
  talk is for; what they should do or feel; from Take 3, with both known,
  one deeper question in their own words. Each once per talk. Will's question
  is never in the lens. Will may say the signed questions with light
  variation, the same meaning in slightly different words; the tap answers
  and the no-numbers rule stay (founder, 2026-10-20); when the variation
  fails a check he says them as signed.
- **E3** The tap answers come from what Will knows: this Take's own words,
  then what the speaker said for an earlier talk, then the signed answers for
  their field; plus Skip, or their own words in the message box; one
  follow-up at most. A Take that names its audience twice is checked instead
  ("Sounds like this one's for {the board}. Right? 🎯"; the guess becomes
  the audience only on Yes). How Will knows: one gpt-4o-mini call per Take
  (`will_question.heard`, drift-locked, golden rows
  `tests/evals/golden/will_question.jsonl`) under the Take's processing
  authorization; it may return only words the title or transcript says, at
  most four, no number, else Will asks openly.
- **E4** Every answer is kept for Will (speaker memory, kind "answer"); who
  the talk is for fills the Take's setup `audience`, what they should do its
  `strategic_context` ("Desired call to action:"). The next Take's setup
  carries them.
- **E5** The founder edits Will's questions on the coach panel, under the
  blind lists ("Will · only you" → "Will's questions"; N83; backend
  `FOUNDER-LOCK-coach-panel-redesign-2026-10-06.md`). A question with no
  saved row keeps the signed words in code.

### F · The Ideal Text page, in the loop

- **F1** It opens from its card, or after the summary. It is not the landing
  screen. The card opens the page on the text, from the top; every other
  bubble with › opens that Take's walk on that step.
- **F2** The text never shows before the walk (A2).
- **F3** Helper words are orange in the text; no pencil. The black margin
  line means something still waits: only a paragraph with a step still to
  answer wears it, and once answered the line goes (2026-10-20).
- **F4** A paragraph with the black line opens the whole Take's walk at the
  step it asks (its helper words with its green moment just above, or the
  Clearer version or the Exercise when that is what waits), exactly as a
  paragraph without the line does (F5); only the step's buttons differ, its
  own while it waits and read only once answered (one mechanism, N89,
  2026-10-20; the paragraph's own narrowed walk that closed onto the Ideal
  Text, the same morning, is history). ✕ goes back to the page (B11). The
  green moment still reaches the chat and the coach's queue.
- **F5** A paragraph without the line opens the same walk at the step that
  paragraph answered, its green moment just above, read only as the step
  stands (N89: the finished walk with no buttons, 2026-10-20 morning, is
  history). Its orange helper words open the same walk, not the picker;
  orange words on a paragraph with no moment in this Take still open their
  helper words alone. A sentence that opens a step shows a light grey
  highlight while pressed; other text does nothing.
- **F6** Buttons: "Record Take N" is the main button; the grey "Close" is the
  one way out, to the chat (no ✕ at the top); history is under ⋯.
- **F7** Rule 5: the Ideal Text is only what the speaker said in their
  latest Take; their helper words stay until they pick new ones; every old
  version stays in the history.
- **F8** Everything else on the page (how helper words look, the sheets,
  Presentation Mode, export): backend `FOUNDER-LOCK-helper-words-2026-09-30.md`.

### G · Sharing, before the next recording

- **G1** Asked when "Record Take N" is tapped, from Take 2 on, never before
  Take 1; the choice applies to the Take about to be recorded. "After all,
  it's about speaking publicly!" (regular weight) and "Do you agree to share
  your next take with others?"; in the Lounge one bubble, its three lines as
  paragraphs (#847).
- **G2** The options: **General community.** **Only my community**, with the
  speaker's saved communities inside (a passcode entered once; one is ticked;
  several are all ticked and any can be unticked; "+ Add a community with a
  passcode" at the bottom). **Only me**, which stands alone.
- **G3** Who you judge follows who you share with: only my community → that
  community first, the general community fills in; general community → the
  general community, and its members may hear your Take; only me → nobody
  but the coach hears you, and you still judge general-community moments.
- **G4** Consent is per Take, revocable, stamped with the version of the
  words the speaker saw; taking it back removes the Take from every community
  queue. Only the voices of people who agreed reach others; the training
  clips mixed into judging are the licensed corpus. Community answers are
  peer ratings, kept apart from the coach's, the speaker's own and the
  machine's (L3).

### H · How a moment is picked (backend)

- **H1** `services/willfidence.py`, `services/moment_pick.py`:

  ```
  willfidence(sentence) = S × W                 0 … 1
    S = voice_confidence (7 cues vs the speaker's own baseline)
    W = mean of: few fillers/hedges · fits the slide · holds together
  shown     = the two highest, at most one per slide (a one-slide Take shows
              one); clips with enough words rank before short ones
              (founder confirmed 2026-10-20, with praise before corrections)
  each      ≥ FLOOR → praised; < FLOOR → corrected      (2026-10-20)
  highest   = the first in rank; its bubble opens with the signed line (C2)
  try       = Δ willfidence vs the original ≥ MARGIN (+0.05) → better
  ```

  The unit is the sentence. FLOOR is 0.6 at launch, then calibrated so
  about 7 in 10 blind judges say 👍 to praised sentences. Only the praise is
  sent as "green"; the practise target goes out with no label; the level goes
  out as `level_key` ("W1".."W10"), never the number. A clip with no sound
  read is given the middle of the sound scale and the words order the clips;
  processing logs why nothing was stamped (2026-10-17).
- **H2** The AI clip's problem (pace, pause, stress, fillers) is measured
  against the speaker's own usual delivery; the clip is made once per
  exercise, at the end of the bake, checked before it is shown; the walk asks
  for it after its first minute and shows it whenever it lands. The speaker's
  AI voice is made from Take 1 as the spoken Take is stored, beside its
  processing (N84; it used to wait for the end of processing). The whole
  rule: `FOUNDER-LOCK-ai-voice-practice-2026-10-12.md`.
- **H3** The rewrite gate (`services/rewrite_gate.py`, 2026-10-18): the
  Clearer version only when **the words need help** (fillers or hedges at 3
  or more per 100 words; one word that undermines the speaker, apologising,
  asking permission, self-doubt or playing the idea down, from the closed
  lists in `services/undermining.py`, N85; off the slide below 0.5 fit; or a
  broken sentence) **and the rewrite is good enough** (inside the moment's
  own clip; backed by evidence, never the tentative fallback; a real fix,
  fillers and hedges at least 0.1 better, fewer undermining words, or the
  sentence mended; still theirs, 6 words in 10, no new number or name; no
  longer than what they said and 5 words or more; not turned down before on
  the same words). Anything else → the voice Exercise. For undermining words
  a rule writes the clearer version (`take_feedback_manager.
  _undermining_rewrites`): the same sentence with its apologies, asks for
  permission, self-doubt and softening hedges left out, never a word added;
  a playing-down phrase that would need rewriting makes no rule rewrite, and
  the moment keeps the voice Exercise.

### I · Learning

- **I1** Labels come only from blind answers: the coach, and other speakers
  inside practice. 👍 = 1, 😐 = 0.5, 👎 = 0. A label counts once two answers
  match. "Audio unclear" goes to a fresh judge; twice, and the clip is
  quarantined. The clips judged are half praised and half low sentences.
- **I2** The speaker's own answers are never labels (L3). The AI clip is
  never a label and never enters a training set. The coach never sees the
  machine's guess before answering.
- **I3** Training tunes the willfidence weights against the soft label once
  there are at least 200 labels, speaker-disjoint, checked on the sealed
  golden set and re-sealed under the new question version; the founder
  promotes it as `willfidence-v2`. Coaches answer with the same 👍 😐 👎,
  "Audio unclear" and the signed "Skip"; old answers stay.
- **I4** Will learns about each speaker: every answer and every Take's
  outcome is kept (`services/speaker_memory.py`, `docs/SPEAKER-MEMORY.md`).
  Message relevance (practised, skipped, retried, whether the next Take rose)
  is a report for the founder, not a label. The before/after of each practice
  feeds the exercise picker.
- **I5** Every moment the walk shows reaches the coach's queue
  (`coach_moments_queue.reach_alarm`, #866).

### J · Look and motion, everywhere in the app

- **J1** Minimal: black, white, grey and one orange; no comic or
  handwritten fonts. Inside the walk orange marks only new words and the
  Lounge's "new"; outside it the bars, the helper-word headlines, Presentation
  Mode, the export, Recording Mode and the coach panel's "Something else" stay
  orange (N63).
- **J2** One player and one judgement design across the app. Every message
  is plain text with a small grey avatar. The speaker's part is their voice;
  their words show only where the feedback is about the words.
- **J3** Feedback opens as a full-screen overlay; nothing of the page shows
  behind it. The overlay slides in from the right over the page (0.34 s) and
  is swiped out to the left (0.28 s, 2026-10-18), the page already underneath
  (`src/lib/willab/walkMotion.ts`).
- **J4** Nothing blinks: what arrives eases out (`cubic-bezier(.2,.8,.2,1)`),
  what leaves eases in (`cubic-bezier(.4,0,1,1)`). Inside the lens bubbles
  land behind the typing dots (B7); where a screen still swaps, the top bar
  stays and the old content slips 22 px away (0.14 s) while the new slides in
  from the side headed to (0.3 s after 0.1 s); a soft cross-fade with a slight
  lift (0.34 s) for a screen that stands apart or one moment changing state.
- **J5** Lounge and the text: a short sideways push. Recording Mode: a soft
  0.4 s fade in and out, never delaying the recording. End card: the page
  dims and the card rises. A pressed button gives way slightly (scale 0.98);
  a chosen answer fills black, holds 0.28 s, then moves on; ticks, words and
  colour changes fade in 0.16 s; redrawing the same screen does not move.
  With reduce motion on, every move is instant.

### K · Words on screen (all signed)

- **The walk's labels:** "Your coach:", "Continue", "Next", "Good job",
  "Skip", "Practise", "Practise again", "Stop", "Close", "Continue review",
  "Slide N", "Slide N · helper words", "Take N", "Other speakers",
  "Other speakers · N of N", "Practise N", "🔒 Take N", "Processing your
  recording", "Later · from your coach", "Updated with your coach's note ·
  see / hide the earlier version".
- **Helper words:** "Choose your helper words", "N of 6 words", "Use these
  helper words", "Edit the helper words" (signed 2026-10-21), "Keep these".
- **A try not heard:** "We couldn't hear that clearly. Try again." (signed
  2026-10-21).
- **The Clearer version:** "Here is a slightly more polished option:", "Do
  you accept and want to practise it?", "Accept and practise", "Keep my
  words"; for undermining words B10's "Say what you mean. Don't dance around
  it, just say it straight." and B13's "Try saying it like this:" (signed
  lines in a new place, N85).
- **Praise:** "This was your most confident moment." and "This was your
  most confident moment so far." (signed 2026-10-20).
- **Practise:** Line A "Say this one like your confident moment."; "That
  sounded more assured than the first."; the praise, not-yet and move-on
  lines of the signed bank (backend `docs/SIGNED-line-bank-2026-10-06.md`,
  `services/line_bank.py`); the opening lines W1–W10
  (`src/lib/willab/praiseLevels.ts`); the AI clip's L1–L18 (backend
  `FOUNDER-LOCK-ai-voice-practice-2026-10-12.md`).
- **Other speakers:** Line B "Now one moment from another speaker." / "Now N
  moments from other speakers." / "Now one moment from {community}."; "Does
  this sound confident to you?"; "Yes", "In-between", "No", "Audio unclear".
- **Sharing:** "After all, it's about speaking publicly!", "Do you agree to
  share your next take with others?", "General community", "Only my
  community", "Only me", "+ Add a community with a passcode".
- **The Ideal Text:** "Record Take N", "Close".
- **The chain's close:** "Look, practice makes perfect. If you're ready,
  let's go with the next take." with an encouraging emoji (💪; signed
  2026-10-20, N89), then "Record Take N".
- **The one ask:** "Did this help?", "We're glad it helped you.", "What
  would help?", "Skip"; Will's lead-ins (E1) are his own words around the
  ask's signed text, checked; Will's questions and tap answers as signed in N82
  (backend `services/will_question.py`; the questions may vary lightly from
  2026-10-20, the tap answers never): "Quick one: who's this talk really
  for? 🎯"; "When you finish, what do you want them to do? Or feel? 🤔";
  "Last time we practised “…”. It didn't make it into this Take. On purpose?
  😏" (Yes, on purpose · I forgot · It didn't feel like me); "You've put real
  work into this one 💪 Need a breather, or does something feel missing?" (A
  breather · Something's missing · All good, keep going); "Zoom out with me
  🔭 Does this talk take you where you want to go?" (Yes · Not sure · Not
  really); "Which part of this talk is most you?"; "Why does this one matter
  to you?"; "If this talk goes perfectly, what changes for you?"; the
  follow-ups "Who is it for, then? 👀", "Tell me more 👀 What's missing?",
  "What would feel more like you?", "What would make it a yes?", "Where do
  you want it to take you?"; "Got it, thanks 🙏"; "Sounds like this one's
  for {the board}. Right? 🎯" (Yes · Someone else); the answers by field
  (business: My team · Leadership · A client; public speaking: A big room ·
  Colleagues · Friends and family; sales: A buyer · Their team · The decision
  maker; customer service: A customer · A caller · My team; interviews: The
  hiring manager · A panel · A recruiter); goal: Say yes · Trust me · Get it.
- **Signed, no longer shown:** "Judgement time!", "If you are honest when
  judging others, it will help you find your confident voice and calm the
  inner critic 😌", "More about self-modeling theory", "I am going to judge
  them honestly", "Not sure", "Moment N of N", "It was better, and I have
  yet another practice for you to try!", "Exercise" and L2 "Here's how you
  could say it." as the Exercise's opening (L4 took their place, N82).

---

## 2. In flight

One line per piece of work: `item · what it is · the rules it touches ·
where it stands · PR`. The session doing it fills its line in its PR and
deletes the line when the work is merged (the change goes to §6).

- **WIL-76** · the stale processing step (urgent) · A1, A2 · confirmed in the app 2026-10-20 ("it doesn't open right after the processing"). Built: the marks are baked in the run right after ready (BE), the processing bubble waits for them and the page keeps asking for late marks to its ceiling and closes its slot when it stops (FE) · BE #1209, FE #896 · the founder checks the app
- **WIL-89** · the lens as one chat: the opening order, the lenses, the interventions × chat awareness · B, C1, F · built and merged: FE #868, #882, #885, #886; BE #1170, #1190, #1194, #1196. Whether it works as drawn is the founder's check in the app ("success?") · to confirm
- **WIL-84, WIL-86** · videos match (the coach's changed word and video, N80) · C1, D5 · built and merged: BE #1160, FE #861, FE #872 (the speaker's side). One backend follow-up stays: a later change of the coach's word updates the in-review bubble in place (D5) · to confirm in the app
- **WIL-90** · the exercise is blocked · C6, C7 · BE #1206 fixed the coach's gate; built 2026-10-20: the Manager's exercise offer, the verbal-cue gate and the error-presence audit read the speaker's own page too · BE #1209 · the founder checks the app

The four lines above were filled from main's history by the page's keeper on
2026-10-20; the sessions doing the work overwrite them when they push.
- **N90 · the walk's doors, checked in the app** · B10, C1, D5, F4, F5 · founder 2026-10-21: a coach's bubble and an Exercise bubble in the Lounge opened the Ideal Text page, not the walk; "the WALK opens up immediately on that part, but you can scroll to previous parts or scroll to the next ones". Built: a step already answered past opens the walk on that step with the parts before and after it there to scroll (FE) · FE — · the founder checks the app
- **N90 · the coach's bubble at the bottom** · D5 · founder 2026-10-21 ("it should be at the bottom, like it's a new message"). Found: a word shared during the review was never written as its own bubble, so it reached the chat only as the walk's copy among the Take's steps. Built: the "Later · from your coach" bubble is written the moment the coach shares, review ended or not (BE) · BE #1211 · the founder checks the app
- **N90 · a try not heard; Edit the helper words** · C3, C7, K · founder signed both lines 2026-10-21. Built: the walk says "We couldn't hear that clearly. Try again." with Practise again and Next on a 422 from the server; an answered helpers step's pill reads "Edit the helper words" (FE) · FE — · the founder checks the app
- **N89 · one mechanism opens the walk** · B10, C1, D5, F4, F5 · founder 2026-10-20 ("the SAME WAY", "THE SAME MECHANISM"). Built: every door (a paragraph with or without the line, a Lounge bubble, the coach's word) opens the whole Take's walk at its step through one path; the narrowed walk, the finished walk with no buttons and the coach's own lens are gone · FE #897 · the founder checks the app; the "edit the helper words" wording signed 2026-10-21 (N90)
- **N89 · the chain after the Take** · D3, D4, E1, K · founder 2026-10-20. Built: the summary without the next step and without the CTA; the closing message held behind the chain, each ask in turn with Will's lead-in, "Did this help?" when the Take looks off, then "Look, practice makes perfect…" with Record Take N (BE); the Lounge reads the closing message as the held row and puts the CTA under it (FE) · BE #1210, FE #897 · the founder checks the app. Choices made and confirmed 2026-10-21: "Did this help?" keeps its "looks off" condition and comes last; Take 1 still skips WhatsApp and the CEO panel's asks; the CEO panel's asks and Will's own question get no lead-in
- **The rewrite does not appear** · C4, C5 · founder 2026-10-20. Found: the served rewrite row carried no block id, so the walk drew it as a moment of its own and the Clearer version never attached (BE); a corrected moment with neither rewrite nor exercise was dropped instead of said again (FE). Both built · BE #1209, FE #896 · the founder checks the app
- **The AI voice bubble loads, then disappears** · C6, H2 · founder 2026-10-20. Found: a failed clip cycle is final and its real failure code was lost (a permit refusal stored as its class name). Built: the code is kept and a permit the service could not read is retried once (BE). The cause for the founder's Takes is in Supabase `ai_voice_cycles` (`failure_kind`, `failure_code`): most likely the daily limits (10 clips a speaker, 30 in all; `AI_VOICE_DAILY_CLIPS_PER_SPEAKER`, `AI_VOICE_DAILY_CLIPS_TOTAL` on Railway) or a check the one generation failed (`AI_VOICE_GENERATION_RETRIES` is 0) · BE #1209 · the founder reads the row
- **The coach's bubble did not open** · C1, D5 · founder 2026-10-20. Found: the walk's own copy of an earlier Take's word was tapped as a step and opened nothing (or a read-only review); the "Later" bubble opens the lens. Built: every coach bubble opens the coach's word in the lens, Close marks that word's Take, and a lapsed video link is refreshed · FE #896 · the founder checks the app
- **Helpers open as a separate single action** · C3, F5 · founder 2026-10-20. Found: the Lounge's helper-words bubble opened before the marks were in, so a paragraph with a moment showed its words alone. Built: it waits for the marks unless the paragraph already has its moment · FE #896 · the founder checks the app
- **The card lands between the data question and its buttons** · D4 · founder 2026-10-20. Found: the admin's asks were stamped only with the message they wait for, so the card was not moved above them. Built: the ask carries its Take, and the order resolves older asks through the message they wait for · FE #896 · the founder checks the app
- **The lens scrolls** · B2, B5 · founder 2026-10-20 ("It is scrollable!"), read as WIL-89 working as drawn; say if that was a complaint · confirmed
- **Review from the Lounge loads very long** · F1, A2 · founder 2026-10-20. The same cause as WIL-76: the marks computed live (20 to 40 s) or pending behind a queued bake; the bake in the run stores them before the Take is ready, so the tap finds them · BE #1209 · the founder checks the app

## 3. Still open

- **Self-judgement of your own practice try** is off for launch (2026-10-12):
  4 speaker answers, 21 clips with coach answers, 1 with both. Re-run the
  query pack's `1-enough-data.sql` once `clips_with_both` reaches about 50,
  then show the founder the numbers; the founder decides (confirmed
  2026-10-20).
- **A Stop tapped before the mic has started** may leave the typing dots
  up and the mic on (read in the code 2026-10-20, not reproduced): the
  recorder's stop does nothing until the mic reports started.
- **FLOOR** is 0.6 until the blind judges calibrate it (H1).
- **willfidence-v2** waits for 200 labels (I3).

## 4. Where it lives

Frontend, guarded by `scripts/flow-pages.txt` (a change must change this
page):

- `src/components/willab/walk/` — the lens: `FeedbackWalk.tsx` (the walk),
  `WalkThread.tsx` (the thread and its scrolling), the steps' screens, the
  recorder strip, the word picker, the AI voice bubble.
- `src/components/willab/WalkEnd.tsx` — the end of the walk.
- `src/lib/willab/walkPlan.ts` — the order of steps from a Take's moments.
- `src/lib/willab/feedbackWalkModel.ts` — the walk as mounted on the page.
- `src/lib/willab/walkThread.ts` — the steps as Lounge messages, stored once.
- `src/lib/willab/lensScreen.ts` — the lens's wait before the walk (A2).
- `src/lib/willab/walkMotion.ts`, `src/lib/willab/walkLines.ts`,
  `src/lib/willab/praiseLevels.ts`, `src/lib/willab/walkPractise.ts`,
  `src/lib/willab/walkTries.ts` — motion, the line rotation, the opening
  lines, the practise loop, the tries.
- `src/components/willab/useDeckFeedbackWalk.tsx` — how a paragraph tap
  opens the walk and the coach-queue report (F4, F5, I5).

Frontend, shared with other flows (not guarded): `src/components/willab/Lounge.tsx`
(the chat), `src/components/willab/useLoungeThread.ts`,
`src/components/willab/TranscriptReviewDeck.tsx` (the black line and the
paragraph tap), `src/components/willab/IdealTextOverlay.tsx` and
`idealTextLoad.ts` (the page and its loading), `src/components/willab/loungeReports.ts`.
The Ideal Text's own files are in `scripts/design-locked-files.txt`.

Backend (`wilplus/backend-cursor`): `services/moment_pick.py`,
`services/take_feedback_policy_v3.py` (the marks), `services/willfidence.py`,
`services/rewrite_gate.py` (H);
`services/take_summary.py` (D); `services/after_take.py`,
`services/will_question.py`, `services/feedback_check.py` (E);
`services/coach_message_read.py` (`coach_message_for`, C1);
`services/line_bank.py` (K); `services/speaker_memory.py` (I4);
`services/coach_moments_queue.py` (I5); `services/chat_query.py` (the
Lounge's turn).

Tests that hold the promises: `src/components/willab/walk/feedbackWalk.test.tsx`,
`walkPractise.test.tsx`, `walkReplay.test.tsx`,
`src/components/willab/deckFeedbackWalk.test.tsx`,
`src/components/willab/walkReachesCoach.test.ts`,
`src/components/willab/loungeNewCoachFeedback.test.tsx`,
`src/lib/willab/walkPlan.test.ts`, `walkThread.test.ts`, `lensScreen.test.ts`;
backend `tests/test_speaker_memory.py`. Every test's story: `docs/TEST-STORIES.csv`.

## 5. Prototypes

The design is the prototype; the newest wins where two disagree.

- **Current:** the lens, the Ideal Text and the Lounge
  <https://claude.ai/artifact/MpiAtrUz4DNBKm3EvhA6fm> (2026-10-20); the lens
  as one chat <https://claude.ai/artifact/P5fHFguyCgjhMGPsmH7UaD> (N81);
  Will's question <https://claude.ai/artifact/HSRfvDZLDRQizmGJDxMUJz> (N82);
  one action at a time <https://claude.ai/artifact/AT5A7Govq7G6n3UpbEiaQ5>;
  the coach's changed word <https://claude.ai/artifact/APk56PLZt6o6Cx9qUMKkuk>
  (N80); words first <https://claude.ai/artifact/Ut2SqvHCoJ1hvH8dp17yQe> and
  its criteria <https://claude.ai/artifact/Kr97WV8e2PNZwf4FPcsKUW> (N76);
  practise again <https://claude.ai/artifact/URLdtuBvG5rbrzFePfMcUv>
  (2026-10-18); the Exercise as one thread
  <https://claude.ai/artifact/8nGuDXywGDWAZje3EcFMaj> (2026-10-16); Walk
  first <https://claude.ai/artifact/Bsf3x3HWN2jJVY35edRKw8> (2026-10-14); the
  AI voice <https://claude.ai/artifact/G8Am3fR3f3SzAdTkwyUGKZ> (v8).
- **The base:** moment and feedback as one chat with a lens
  <https://claude.ai/artifact/TXbwmupWJio6N1gHqdEa7p> (version 27, locked
  2026-10-12; 31 final).
- **History:** the Feedback walk, 2026-10-06
  <https://claude.ai/artifact/C2CTBmU1bfSSDQgJUHTKkE> (version 10); the Ideal
  Text page and helper words, 2026-09-30
  <https://claude.ai/artifact/AeRVS91VUAiJLCePB82s3d>.

## 6. Changes

One line each, newest first: `date · N · what changed · PR`.

- 2026-10-21 · N90 · a step already answered past opens the walk on that step with the parts before and after it there to scroll (B10); the coach's bubble is written at the bottom the moment the coach shares (D5); a try not heard says so with Practise again and Next (C7, K); an answered helpers step's pill reads "Edit the helper words" (C3, K); the chain's choices confirmed (E1) · FE —, BE #1211
- 2026-10-20 · N89 · one mechanism opens a place in the walk: a paragraph with or without the line, a Lounge bubble and the coach's word all open the whole Take's walk at its step (B10, C1, D5, F4, F5); the chain after the Take: the summary without the next step, Will's lead-in before each ask, "Did this help?" when the Take looks off, then "Look, practice makes perfect…" with Record Take N (D3, D4, E1, K) · FE #897, BE #1210
- 2026-10-20 · N88 · the walk opens the moment processing ends: the marks are baked in the run right after ready, the processing bubble waits for them, the page asks for late marks to its ceiling and closes its slot when it stops (A1, A2); the Clearer version is served on its moment and a corrected moment with nothing attached is said again (C4); the helpers wait for the marks (C3); every coach bubble opens the coach's word (D5); the ask and its buttons stay together (D4); the speaker-side practice gates read the speaker's page (WIL-90) · BE #1209, FE #896
- 2026-10-20 · N80 · the speaker's side built: the coach's bubble opens only their word in the lens, with Close and the step's "Your coach" line; watched anywhere clears the ring; the walk writes the word into the chat once per Take (D5) · FE #872
- 2026-10-20 · N87 · `WalkOverlay`'s subtitle takes several lines, for the coach panel's speaker screen (its page, C3); nothing on the walk's own screens changes · FE #895
- 2026-10-20 · N86 · the score decides each shown moment, in place of the fixed roles; the highest moment's bubble opens with "This was your most confident moment." (C2, C4, C5, H1, K) · FE #893, BE #1207
- 2026-10-20 · N86 · Will says his question with a light touch (E2, K) · BE #1205
- 2026-10-20 · N86 · the page's first review: the walk opens the moment processing ends (A2); the score decides each shown moment, in place of fixed roles (C2, C4, C5, H1); "This was your most confident moment." signed (C2, K); Will may vary his questions lightly (E2, K); counsel approved L12 and L13 · FE #892, BE #1204
- 2026-10-20 · N85 · the walk spots words that undermine the speaker: the gate, a rule-written clearer version, B10 and B13 as its opener (C5, H3, K) · BE #1201
- 2026-10-20 · N84 · a Good job only when clearly better, +0.05; the AI voice starts as the Take is stored (C7, H2) · BE #1201
- 2026-10-20 · this page replaces the two lock files and the walk's log entries; the design-lock check guards it · FE #890, BE #1202
- 2026-10-20 · a distressed answer under "What would help?" gets the chat's safety reply (E1) · BE #1199
- 2026-10-20 · N83 · the founder edits Will's questions on the coach panel (E5) · FE #887, BE #1197
- 2026-10-20 · a finished paragraph opens the walk at what it answered, orange words too (F5) · FE #886, BE #1196
- 2026-10-20 · "Your coach:", the text never before the walk, this Take's coach word only, the dots' beat 350 ms (A2, B4, B7, C1) · FE #885, BE #1194
- 2026-10-20 · N82 · the voice Exercise opens with praise; Will asks one question after a Take (C6, E2–E4) · FE #883, BE #1191
- 2026-10-20 · the lens full width on a computer, the typing dots the only wait, the newest step to the top (B2, B5, B8) · FE #882, BE #1190
- 2026-10-20 · a paragraph that waits opens on what it asks; a finished one scrolls (F3–F5) · FE #881
- 2026-10-20 · one action at a time: the card, one ask, then Record; the summary ends on the next step, not a question (D3, D4, E1) · FE #875, BE #1177
- 2026-10-20 · N81 · the lens is one chat that grows by taps, behind the typing dots; after a tap it scrolled to the bottom (WIL-89) (B5–B7, B12, C7) · FE #868
- 2026-10-19 · N80 · a coach's changed word: one bubble, a taken-back video never plays, watched anywhere is watched (D5) · BE #1160
- 2026-10-19 · WIL-74 · "Did this feedback help you?" in the Lounge (E1) · FE #852, BE #1149
- 2026-10-18 · N76 · words first, then voice: the rewrite gate decides Clearer version or Exercise (C4, H3) · BE
- 2026-10-18 · practise again until the third try or a Good job, then Next; the same AI clip, a changing not-yet line (C7)
- 2026-10-18 · the walk closes swiped to the left (J3)
- 2026-10-18 · fillers as the AI clip's fourth problem (H2)
- 2026-10-17 · always the two highest willfidence moments; a clip with no sound read gets the middle of the scale (C2, C4, H1)
- 2026-10-16 · the Exercise is one thread; a Good job no longer ended the practise (undone 2026-10-18) (C6)
- 2026-10-16 · WIL-82 · under the AI clip one sentence says why, L14–L17 (C6)
- 2026-10-15 · the AI clip is made at the end of the bake (H2)
- 2026-10-14 · one praise moment and one practise moment per Take, in place of up to three green (C2, C4)
- 2026-10-14 · Walk first: one small card per Take, the walk ends on the Ideal Text, ✕ goes back where opened, answered steps read only, the black margin line (B10, B11, D4, F1, F3)
- 2026-10-14 · the moment's opening line follows its willfidence, W1–W10 (C2)
- 2026-10-14 · the closing summary is cheeky and curious; it ended with a question until 2026-10-20 (D1)
- 2026-10-14 · the lens shows the loader, nothing else, while the walk is on its way (A2)
- 2026-10-13 · an old judging bubble opens "Other speakers" afresh, not a read-only replay (C8)
- 2026-10-12 · N71 · the AI version of your voice in practice (C6)
- 2026-10-12 · the lock "moment and feedback, one chat with a lens": one thread stored once, green moments, one exercise, other speakers after practice, the summary, the Ideal Text page no longer the landing screen, sharing before the next recording; "Judgement time!" and self-judging left the walk (B, C, D, F, G)
- 2026-10-08 · N67 · sharing goes live in the walk (G)
- 2026-10-07 · N63 · how a tap on a paragraph opens; orange inside the walk only; the Recording Mode fade (J1, J5)
- 2026-10-06 · N52–N54 · the Feedback walk locked: praise first, helper words, the clearer version, practise, judgements, sharing; look and motion; the line bank signed · <https://claude.ai/artifact/C2CTBmU1bfSSDQgJUHTKkE>
- 2026-10-05 · N48.3 Q11 A · a coach's word belongs to its Take and Step 0 opens whenever an unseen word exists (narrowed 2026-10-20, C1)
- 2026-09-30 · the helper-words lock: the walk through the text, B1–B10 (superseded 2026-10-06 for the walk; still the Ideal Text's own lock)
