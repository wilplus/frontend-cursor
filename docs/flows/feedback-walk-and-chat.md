# The Feedback walk and the chat

> **Label: In force** · one of the rules, read in N95's order. Every doc and its label: [the master doc](https://github.com/wilplus/backend-cursor/blob/main/README.md) (N106).

One page for one loop: a Take is processed → the lens opens on the walk →
the Ideal Text page → the Lounge chat, the Take's one ask and the summary →
the next Take. Started 2026-10-20 from the two lock files it replaces
(backend [`FOUNDER-LOCK-feedback-walk-2026-10-06.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/FOUNDER-LOCK-feedback-walk-2026-10-06.md) and
[`FOUNDER-LOCK-moment-feedback-chat-2026-10-12.md`](https://github.com/wilplus/backend-cursor/blob/51c67077c3bb09d5a22211f55d9d122919b9983f/docs/FOUNDER-LOCK-moment-feedback-chat-2026-10-12.md)) and the walk's entries
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
- The decisions log (backend [`docs/SPEC-DECISIONS-LOG.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/SPEC-DECISIONS-LOG.md)) keeps its
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

- **A1** While the Take processes, the waiting screen stays on screen. Once
  the server holds the Take, the Lounge takes the wait over and shows the
  same screen at once, full screen, never the chat in between (founder
  2026-10-21, N110: "it is abrupt make it stay"). The bar shows 1% from the
  first second (N110). Its ✕ shows the chat, where "Processing your
  recording" waits with the typing dots (dots in place of the breathing
  mark, 2026-10-20) and a tap opens the wait again. The wait stays until
  the Take's text and its marks are stored: the marks are baked in the
  processing run right after the Take is ready, and the page asks for them
  until they are in (or for ninety seconds) (2026-10-20, WIL-76).
- **A2** The moment processing finishes, the walk opens by itself, with
  nothing in between: the waiting screen stays over it until the walk's
  first step is on screen and lifts then, so "done" never opens onto the
  walk still loading, also when the speaker had gone to the chat (founder
  2026-10-21, N110: "it still loads the walk - so it is not done!"). The
  waiting screen itself stays as it is (founder, 2026-10-20, first review of
  this page). The Ideal Text shows only once the page knows there is nothing
  to walk; the wait lifts onto it. The eight-second last resort counts only
  once the page has loaded, its marks are in and its deck is up. The page
  asks for late marks until its ninety seconds are up and then says so; it
  never holds its slot open without asking (2026-10-20, WIL-76: the typing
  dots that never ended). The wait lifts at the latest when those ninety
  seconds and the last resort are spent, or when no lens has come after
  five seconds (N110).
- **A3** The loop never waits for a coach (2026-09-16, 2026-09-26). The
  coach's word opens the walk only when it is there.

### B · One chat, two views

- **B1** One thread, stored once: the Lounge thread (`lounge_messages`,
  kind `walk_step`). Every step is a message with one author: the speaker,
  the app (line bank), the coach, the rewrite (LLM) or the summary (GPT-4o).
  Nothing is copied. An old step seen again is stored once. The Lounge
  draws a Take's steps as one bubble, the Feedback walk (B3, N192); every
  step is still stored, so Will, the summary and the coach's queue read the
  same rows.
- **B2** Lens on is the walk: the same messages as one chat that grows by
  taps, full screen, 18.5px text, 22px corners, 22px avatar, ‹ › and ✕ in
  the bar, no message box, no scrollbar (wheel, trackpad or finger). On a
  computer the lens is as wide as the Lounge's chat column (max-w-3xl); the
  Ideal Text's Record Take and Close sit in the same column (2026-10-20).
- **B3** **The Lounge** (lens off) is the main view: 15px text, 16px corners,
  20px avatar. After a Take the chat shows, in this order:
  1. the speaker's recording, with who hears it as one line under its player
     (G1);
  2. **the pair:** the Take's "Feedback walk" bubble and, right under it, the
     Take's Ideal Text card (D4);
  3. the chain after the Take, ending with "Look, practice makes perfect…"
     and "Record Take N" (D4).

  **The Feedback walk bubble:** light grey, on the left. It reads "Feedback
  walk"; under it one small grey line: "🔒 Take N" at its start for an older
  Take, "Edited" once something in the walk changed (B13), and the Take's
  date at its end, in the recording's format ("Oct 25, 2026"). Its › opens
  the walk (B10).

  **The pair:**
  - Both are as wide as the card: 80% of the chat, at most 384px. The
    Feedback walk has that width from the moment it lands.
  - The card sits 3px under the Feedback walk, their left corners drawn in
    where they meet. The Feedback walk has no tail: the card closes the pair.
  - While the walk runs, the Feedback walk stands alone: the Take's "Your
    ideal text is ready" card waits for the walk's end. A walk left before
    its end (the next Take recorded) pairs with that card.
  - The pair stays under its recording. Anything that lands while the walk
    waits (the speaker writing to Will) stays under the pair, and the card
    joins its Feedback walk there. Nothing moves.

  **In the walk only:** everything else the walk says: the hello, the coach's
  word (D5), the praise, "Choose your helper words" and the speaker's words,
  the clearer version and the choice, the AI voice's bubble, the tries and
  their answers, other speakers and the answers, and the summary (D4).
  Opening a walk posts nothing in the chat.

  **Record buttons:** under the thread the Lounge has only the message box;
  "Record Take N" is in the thread, under the closing message (D4). With a
  plan, under the plan card, in place of "Type here", there is only "Start
  your first recording" (N161), and on a practice day the chat has one
  record button, in the newest bubble (N167); the plan is decided, not built
  ([`the-plan.md`](the-plan.md) E5, G6).

  (Founder 2026-10-26, N192: "there should be just the ideal text after the
  take and the feedback walk above it", "make sure that all of these are in
  one bubble now in a bubble with a date and a small arrow to open it", then
  "go with A"; N202: "always as two bubble pair", then "yes, go with both
  recommendations". Drawn and not chosen: the card alone with a black line on
  every paragraph the walk has something on, and one card with a Feedback
  walk row.)
- **B4** Bubbles: the speaker orange on the right; the app and the coach
  light grey on the left with a small avatar (the coach's grey-blue). No
  bold in any bubble, the Clearer version's new words included (2026-10-21).
  No sender labels, except "Your coach:" which opens the
  coach's bubble, with the colon (2026-10-20).
- **B5** Nothing swaps. Each step reached lands under the one before;
  earlier steps stay above to scroll back to; nothing leaves the thread while
  the lens is open. Each new bubble, and the typing dots before it, land at
  the bottom, right above the buttons, as in the Lounge; the thread follows
  them down until the speaker scrolls up by hand (founder 2026-10-23, N122;
  until then the newest step came to the top, its name at the top of the
  thread and its bubbles under it, 2026-10-20, which had replaced N81's
  "scroll to the bottom"). The step the walk stands on has the buttons;
  opened on a step already answered, the walk stands on that step and the
  whole Take's walk is in the thread around it (2026-10-21, B10).
- **B6** Each step opens with its name as a small line ("Slide 2", "Slide 2
  · helper words", "Take 2", "Your coach"). The bar shows the step in view;
  ‹ › scroll to the step before or after, within this opening of the walk.
- **B7** The step's buttons are a dock under the thread. A choice lands as
  the speaker's orange bubble, in the words the Lounge stores (helper words
  without the sentence's punctuation at either end, "growth doubled" not
  "growth doubled,", 2026-10-21); the next
  step's bubbles land one after another, each grey one behind the typing
  dots, 350 ms a bubble (the Lounge's beat, 2026-10-20), and its buttons once
  they have all landed. Next and Continue post nothing.
- **B8** The typing dots are the only wait, in the lens and the Lounge: a
  bubble being written, a try checked, other speakers' moments or the summary
  loading, the thread loading, the processing bubble. No breathing mark.
- **B9** Scrolled away from the step the walk stands on, the buttons read
  Next, which brings that step back; the recorder never gives way
  (2026-10-21: "away from", no longer only "back to an answered step").
- **B10** **Every door opens the walk the same way** (one mechanism, N89):
  the whole Take's walk, standing on one step brought to the top, the parts
  before and after it there to scroll. That step has its own buttons in the dock;
  Next moves on to the next part, and after the last onto the page; ✕ goes
  back where the walk was opened from (B11).
  - **The Feedback walk** opens:
    - on the coach's word, while a changed one is not yet seen (C1, D5);
    - while the walk runs, live on the step it waits on;
    - once the walk is done, on its newest step, the rest above to scroll
      back to, as "Review feedback" does;
    - never on the Ideal Text in the walk's place: it always names where to
      open (fixed 2026-10-26, after a walk paused on its summary, or with no
      part to stand on, had opened the text).
  - **"Continue review"** shows above the message box until every step is
    answered. It opens the live walk on what waits, through the same door as
    the Feedback walk.
  - **The orange outline:** the Feedback walk of a Take whose walk still
    waits, or whose coach's word changed and is not yet seen, has a full 2px
    orange stroke all the way round and no tail, so nothing cuts it (the tail
    had covered the ring at its corner).
  - **An answered step** is read only and stands with its own buttons: the
    helper words still editable on the latest Take (F3); any other answered
    step reads Next.
  - **A door that names no step of the walk** (a coach's word on a moment)
    opens on its moment's step. A finished walk asked for a step it does not
    hold, or for its summary, stands on its newest step.
  - **A Take not yet finished:** the same whole walk as it stands, what is
    answered as given and what waits live, each moment under the number the
    Take's walk gave it, so nothing is posted again as a new bubble.
  - **An older Take's walk** is read only and ends on that Take's Ideal Text.

  (Founder 2026-10-20, N89: "THE SAME MECHANISM"; 2026-10-21, N91: "the WALK
  opens up immediately on that part of the WALK, but you can scroll to
  previous parts or scroll to the next ones", "on a click you close the walk
  and not go to the next element of it"; 2026-10-21: "the opening of the
  bubbles doesn't open the walk in a scrollable manner"; 2026-10-26, N192:
  "make sure it is well visible and not cut the stroke is there clearly";
  2026-10-26: "the feedback walk opens the ideal text instead of the feedback
  walk!".)
- **B11** ✕ turns the lens off and goes back where the step was opened
  from: the chat, or the Ideal Text page for a step opened from a paragraph.
  ✕ keeps a coach word's "new" ring.
- **B12** The Lounge no longer repeats the lens: the walk's words are said
  in the walk only, and the Lounge's one bubble for them is the Feedback
  walk (B3; founder 2026-10-26, N192: "I know it overrides the rule that
  whatever happens in the walk is shown in the chart, but we need to do it to
  clean the conversational chat").
- **B13** **Edited.** Anything in a Take's walk that changes after it was
  said is an edit, not a new message: the speaker's helper words (C3), the
  coach's changed word (D5), and the summary a coach's note rewrites (D5).
  - In the walk, the bubble that changed shows its new words in place and
    reads "Edited", small and grey, at its end.
  - In the chat, the Take's Feedback walk reads "Edited" before its date, in
    its own place, as WhatsApp writes "Edited 10:42".
  - Nothing lands at the bottom and the chat does not scroll.

  (Founder 2026-10-26, N192: "it should show on the feedback walk as edited
  like on the whatsapp; but it should not go at the bttom like a new message
  cause it is not!")

### C · The walk, in order

- **C0 Hello.** The walk opens once with the speaker's first name: "Hi
  {name}, good to see you back!", on Take 1 "Hi {name}, great to meet
  you!"; with no name on the account "Hi, good to see you back!" / "Hi,
  great to meet you!" (founder 2026-10-23, N120).
- **C1 Your coach.** First, if there is one: "Your coach:", the coach's
  bubble (video or words only; everything the coach sent), then "Continue".
  Only this Take's coach word opens it (2026-10-20, narrowing N48.3 Q11 A):
  an earlier Take's word served in its place stays in the Lounge as the
  coach's bubble and neither opens Step 0 nor keeps "Continue review" up.
  The coach's own doors (the WhatsApp and email links, the dot card, the
  "Later · from your coach" bubble, and a Feedback walk whose coach's word
  changed, B10) open the walk at the coach's place: Step 0 for
  a general word, the moment's step for a word on a particular moment (one
  mechanism, N89, 2026-10-20). The WhatsApp and email links name the Take
  the coach wrote on (`&take=<session_id>`, backend N77, 2026-10-21) and
  open that Take's coach-only walk with its word, so a word left on an
  earlier Take after a newer one still opens as that Take's word; a link
  without it opens as before. A link naming an earlier Take shows only that
  Take's word, then Continue: the coach's moment answers that follow the
  word are the latest Take's and never mix with another Take's word
  (founder, 2026-10-21). A link naming the latest Take, or none, shows the
  word, then the moment answers. A moment answer's link naming an earlier
  Take shows that Take's word if it has one, and otherwise goes back to the
  chat. A coach's door opens the coach's feedback for its Take, read or not:
  what still waits live, the word first with its Continue; once all of it
  was seen, the word and the coach's answers as given, to scroll; no
  "already viewed" notice (WIL-93, founder 2026-10-21, "ok do it"). With
  nothing of the coach's on the page it goes back to the chat, scrolled to
  the coach's "Later" bubble for that Take, or to its Feedback walk when the
  coach's word is the walk's own (N192), which pulses once (the scroll alone for
  reduced motion), never to the text (founder 2026-10-21: "at least just
  open the lounge"). Tapped where the speaker is signed out,
  the WhatsApp and email links go to log in and come back to the same link,
  never to the guest's "Done" screen; opened in an account the project is
  not in, the page says "This link is for another account." with "Log in
  with that account", which signs out and comes back to the link, never
  "Building your Ideal Text" (WIL-93, 2026-10-21). A coach's word on a moment reaches the page
  as it stands, its video with it: the page's stored feedback rows re-read
  the coach's answer on every read, the video's link signed afresh, and a
  coach's share asks for the rows to be baked again (backend, N92,
  2026-10-21: "the video was sent too with the coach feedback and didn't
  pass through").
- **C2 Praise.** The Take's two best moments are shown, however low,
  never two in one paragraph and both on one slide when that is where they
  are (H1; founder, 2026-10-23, N118: "minimum 2; best two"; a Take whose
  clips all sit in one block is cut so it shows two, and a sentence that
  holds the helper words its slide had when the Take was recorded gives its
  place to the next best, 2026-10-28, N246: "go for the next confident
  moment"; on a plan the level's moment comes as well, the-plan.md G7),
  praise first
  and then the corrections, each group in slide order, and the voice decides
  each: a moment whose voice reaches the floor is praised unless its words
  need help (then the Clearer version, C5), one whose voice is under it is
  corrected (C4); both strong, two praises, each practised (N122; until then no practise); both weak, two
  corrections (founder, 2026-10-21, N108: "Voice decides", after a moment
  that "was a confident moment ... even more confident than the first one"
  was told "Say this one like your confident moment."; until then S × W
  decided, 2026-10-20, so weaker words could put a stronger voice under the
  floor; the fixed roles of 2026-10-14 and 2026-10-17 are history). A
  praised moment:
  its clip as the speaker's orange bubble; on the highest moment the line
  "This was your most confident moment." (signed 2026-10-20), then the
  opening line by its level (W1–W10, three signed lines a level, rotated;
  `src/lib/willab/praiseLevels.ts`) and under it the cue's line from
  B01–B09; "Good job" stands in for the level line only when no level is
  sent (founder 2026-10-21: the level line is the praise's own title). These
  shorter lines stay (founder 2026-10-23, N122: N120's one-sentence praise
  was dropped before it was built). When the highest moment is corrected, its clearer version or Exercise opens with one line that names
  it solid and confident and fits what follows: a clearer version (then its
  B13 line), an example (the AI clip, in place of the AI bubble's opener, C6,
  or an exercise's video), or saying it again when no example came; three
  phrasings each around the founder's "This was a solid, confident moment we
  recognised. Here is an example to make it even better.", picked by the
  moment so the lens and the chat say the same (K); Line A is never said on
  that moment (founder, 2026-10-21: it had said "so far", gone straight to
  the fix and asked the confident moment to sound like the confident moment;
  "vary around the line I suggested … no abruptions"). Then
  "Next". A praised moment is then practised (founder 2026-10-23, N122:
  "do we practice the confident moments? I think yes we should!"): C6's
  short bubble with its tip, the AI clip of their own sentence a little
  stronger, up to three tries as C7, a Good job ends it, then its helper
  words (C3); with no AI clip there is no practise and the praise stands on
  its own. Praise is never
  promised. A served moment with nothing attached is the moment said again,
  so the lens always has a step; with no moment at all the text shows.
  Helper words kept from an earlier Take settle nothing: this Take's moment
  on that paragraph is walked like any other, praise first (founder
  2026-10-21: the Exercise had opened the walk and the confident moment came
  later; the server already counted only this Take's words, 2026-10-13).
- **C3 Choose your helper words**, after each praised moment, after the
  Clearer version of a moment whose voice reached the floor (C5; founder
  2026-10-22, N113: "After the rewording"; until then helper words came only
  after a praise, so a Take whose strong voices were all reworded had none),
  and after a correction whose practise ends on a Good job, right after it
  (C7; founder 2026-10-27, N220: "if you improved, you can make it your
  habit words"; until then a correction's Good job went on with none, so a
  Take whose two moments were both under the floor had no helper words); a
  moment gets them once. Words saved at the first of two moments on one
  slide never take the second away: a moment the walk shows stays until it
  is answered (founder 2026-10-28, N246 item 5, "Second stays"; until then
  the saved paragraph was done, lock 2026-09-30 D8, and the second left the
  walk). The step:
  a big bubble in the thread with large plain word buttons, no borders,
  chosen words orange;
  "N of 8 words" at the top, the count against the cap (eight since
  2026-10-15; N178), in place of "Tap the words" (2026-10-21); "Use these helper
  words" and "Skip"; once the words are
  given, the pill reads "Edit the helper words" and the link "Keep these"
  (founder, signed 2026-10-21). Helper words stay
  editable in the walk, opened from the Take's Feedback walk or from their
  orange words on the Ideal Text (F5), on the latest Take only (rule 5); an
  older Take's words are locked ("🔒 Take N"). A change is an edit (B13): the
  speaker's words bubble shows the new words in place and reads "Edited", no
  second bubble and no struck-through old words (N192). They come from a
  moment that sounded confident. Opened while the marks may still land, the
  picker waits for them, so it is the Take's step in the walk and not one
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
  clearer version nor an exercise is said again with the AI clip; when no
  AI clip comes either, the walk moves past it, never Line A on its own,
  and the moment still reaches the coach (founder 2026-10-21, N108: "Skip
  that moment"; it was "said again, never dropped", N88). Played again with
  no try, it shows the clip alone. The Take's most confident moment is not
  skipped: it opens with its own line and is said again (N109, C2).
- **C5 The Clearer version.** The speaker's words with the changed words
  crossed out; "Here is a slightly more polished option:" (when the reason is
  undermining words, `rewrite_reason: "undermining"`, B10's "Say what you
  mean. Don't dance around it, just say it straight." and "Try saying it
  like this:" in its place, N85); the new text with the new words in orange;
  "Do you accept and want to practise it?", with no "Clearer version" title
  over them (2026-10-21);
  "Accept and practise" / "Keep my words" (which practises their own
  sentence with Line A). At most one rewrite per corrected moment. An accepted version
  never changes the Ideal Text (rule 5): it gets there when it is said in the
  next Take. After a try only the voice is checked, on the same lanes as the
  Exercise: better is the Good job and no clip; not yet brings the AI clip of
  the accepted words (or their own after "Keep my words") in C6's short
  bubble, closed by "Try again." (N120; until then L4, L3, then L5). A try with no sound read is a Good job. An answered Clearer version
  stays read only, in the walk and from the Lounge. When the moment's voice
  reached the floor, its helper words (C3) follow the Clearer version and
  its practise, after a Skip too (N113).
- **C6 The voice Exercise** opens with one short bubble (founder
  2026-10-23, N120): a one-word opener ("Nice." / "Close." / "Good."), one
  tip for the problem the clip fixes, ending ", like this:" (K), the AI
  version of their voice, then "Your turn."; until then L4 "That was good.
  But what if you said it more like this?", the clip and L3 "Now try saying
  it like that." (N82), with L14–L18 under the player. When a library video fits exactly
  and targets the chosen problem, the video and its instruction (the coach's
  when there is one, else Line A) take the clip's place, then "Practise";
  no "Exercise" title on this path either (2026-10-21).
  The tip takes the place of the sentence under the player. Without a
  clip the Exercise is as locked. The Exercise is one thread showing its
  whole history: the clip, the Exercise, every try and its answer
  (2026-10-16). The clip's own rules: backend
  [`FOUNDER-LOCK-ai-voice-practice-2026-10-12.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/FOUNDER-LOCK-ai-voice-practice-2026-10-12.md).
- **C7 Practise.** Every practise is one thread: the words to say, the
  recorder in the dock (the strip with the dot, the clock and the bar;
  "Skip" in the Back style and a red "Stop" in the Finish-take style), the
  try as the orange "Practise N", the typing dots while it is checked, then
  the answer. Each try keeps its own number and its own voice on screen, a
  try the server did not keep (late, not sent, not heard) included: the
  next is numbered after it (2026-10-21). The recorder is the recording screen as re-locked 2026-10-12
  (N70) without the slide card; after Stop the walk returns instantly. The
  machine decides (H1): a Good job on the voice alone needs the margin,
  +0.05 (`after_practice.GOOD_JOB_MARGIN`, N84); a cleared problem, or a cue
  moved by at least half a within-speaker deviation, counts too; a clearer
  version's try with no sound read is a Good job; a smaller rise is a not
  yet. It never asks the speaker how it sounded. **Not yet:** C6's short bubble again, an opener and the
  tip, the same AI clip, then "Try again." (N120; until then a not-yet line
  that changes each time and the clip with L5), and under it only "Practise" or "Practise again"
  with the red dot, no Next and no Skip, until a Good job or the third try
  (2026-10-18). **Better:** "Good job", "That sounded more assured than the
  first.", Next; a Good job ends the practise, and Next opens the moment's
  helper words (C3, N220) when nothing else in the walk offers them. At
  most three tries, then Next alone, with the signed move-on line when the
  third was not praise, and no helper words. A
  late answer offers Practise again while a try is left. A try the server
  could not hear (too short, no speech, not the passage, nothing to
  compare) is answered "We couldn't hear that clearly. Try again." with
  "Practise again" and "Next" (founder, signed 2026-10-21; until then it
  looked like a late answer with nothing said). The server still accepts
  tries after a praise; the app no longer offers them. Played again,
  a finished walk shows the thread and Next only: nothing is recorded there.
  Nothing else interrupts the practice.
- **C8 Other speakers**, once, after the practice: three moments, one the
  machine reads high, one in the middle and one low, each from a different
  speaker, never the speaker's own and never one they already judged, in a
  shuffled order so the place never tells the level; the set is fixed for
  the Take. A community clip takes its level's place when there is one; the
  training corpus fills the rest (G4). With fewer than three different
  speakers it shows fewer, never one speaker twice; with none the step is
  left out and the server logs it (founder 2026-10-23, N119; until then one
  moment per try, N97). The first
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
- **D4** **How the review ends in the chat**, one action at a time, each
  after the one before is answered (N89):
  1. the Take's small card (its first slide, the project's name, a version
     tag such as "2.0", the coach's "new" dot on the project's newest card
     drawn), right under its Feedback walk, one pair (B3, N202);
  2. every ask that waits (E1), each opened by Will's lead-in line and
     followed by its buttons. The ask and its buttons are adjacent: the card
     is moved above the Take's whole batch, the admin's asks included
     (2026-10-20: the card had landed between the data question and its
     buttons);
  3. only then "Look, practice makes perfect. If you're ready, let's go with
     the next take. 💪" with "Record Take N" under it (backend
     `services/after_take.py`). The closing message is held back while the
     chain runs. On a practice day the chat has one record button, in the
     newest bubble: the closing message keeps its words and gives its button
     up to the practice day's bubble that comes after it (N167; decided, not
     built, [`the-plan.md`](the-plan.md) G6).

  From the moment the next Take is recorded until its walk reaches its
  summary, the chat offers no Take: the last Take's closing message keeps its
  words and gives "Record Take N" up, while the Take processes and while its
  walk runs, and the new Take's own closing message brings it back (founder
  2026-10-28, N244: "disable the new event while the processing is
  happening, so that it is only possible once it's finished"). The "+" and
  the Ideal Text page's own "Record Take N" are as before.

  The summary is the walk's last step (C9) and is not drawn in the chat
  (founder 2026-10-26, N192, question 1: "In the walk only").
- **D5** **The coach's word.**
  - **There when the walk ran:** it is the walk's own (C1) and is not copied
    into the chat (N192, question 2).
  - **Sent later:** it lands at the bottom of the chat under "Later · from
    your coach", outlined in orange, like a new message, the moment the
    coach shares it, whether or not the review has ended. One bubble per
    Take word, never stacked (N80; founder 2026-10-21: before, a word shared
    during the review reached the chat only as the walk's copy).
  - **Changed by the coach:** an edit (B13). Its bubble, in the walk and
    under "Later · from your coach", shows the new words and video in place
    and reads "Edited"; the Take's Feedback walk reads "Edited"; the bubble
    that holds the word (the "Later" bubble, or the Feedback walk when the
    word is the walk's own) is outlined until opened. Nothing moves to the
    bottom (N192; before, it moved to the bottom with the latest words and
    video, N80).
  - **The summary:** the word rewrites it in place; "Updated with your
    coach's note · see / hide the earlier version" shows the summary from
    before any coach note (or the first summary, when it already heard the
    coach). A video-only change does not rewrite the summary; the same words
    and video again change nothing.
  - **Videos:** a removed or replaced coach video no longer plays anywhere in
    the chat (the file stays stored). During the review a new or removed
    video with the same words makes the word new again (C1 again); a later
    change updates the bubble in place.
  - **Seen:** watching the word anywhere clears its "new" marks; only
    "Continue" on the coach's step marks it watched. The walk no longer
    writes the coach's words into the chat (N192).
  - **A tap** on the bubble opens the walk at the coach's place (C1; N89:
    the word alone in its own lens with "Close", N80, is history).
  - **During a recording** a coach update waits in the chat.

### E · The Take's one ask (backend `services/after_take.py`)

- **E1** After the summary comes one ask at most: the first that waits, in
  this order; the others wait for a later Take (backend N189, 2026-10-26;
  was at most two, N94). The order: the CEO panel's ask (from Take 2),
  WhatsApp (from Take 1 once the Take has gone to the coach, backend N171;
  at most twice in all), the home screen (once, from Take 2), Will's
  question, "Did this help?" when the Take looks off. So Take 1 brings the
  WhatsApp ask and Take 2 the home screen. Will
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
  safety reply (backend #1199). The WhatsApp ask's form says, over the
  number field: "We will only use it to let you know your coach texted
  you, or that your call starts soon." The same number gets a booked call's
  reminder; the booking form asks for none (backend N207, 2026-10-26). The
  field shows the country by its flag, Poland first (consent-screens.md,
  "WhatsApp as a way in"); Save sends a code on WhatsApp, and the card then
  asks "Enter the code we sent you on WhatsApp" with Not now | Continue,
  Resend code and Use a different number. Once the code is typed, the
  number gets the messages and signs in with WhatsApp too: one number,
  checked once (backend N230, 2026-10-28). A full number typed in the chat
  is not saved there: Will answers "Enter the code we sent you on WhatsApp"
  and the form opens on the code step with that number's code already sent
  (backend N235). A number another account signs in with gets "That number
  already has an account."
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
  [`FOUNDER-LOCK-coach-panel-redesign-2026-10-06.md`](https://github.com/wilplus/backend-cursor/blob/51c67077c3bb09d5a22211f55d9d122919b9983f/docs/FOUNDER-LOCK-coach-panel-redesign-2026-10-06.md)). A question with no
  saved row keeps the signed words in code.

### F · The Ideal Text page, in the loop

- **F1** It opens from its card, or after the summary. It is not the landing
  screen. The card opens the page on the text, from the top; the Take's
  Feedback walk opens its walk (B10).
- **F2** The text never shows before the walk (A2).
- **F3** Helper words are orange in the text; no pencil. The black margin
  line means something still waits: only a paragraph with a step still to
  answer wears it, and once answered the line goes (2026-10-20). Helper
  words answer a paragraph's moment only when picked in this Take (the
  speaker's bubble in the walk); words kept from an earlier Take do not
  (2026-10-21). A moment is answered once the walk goes on past it: its
  helper words used or skipped, its practise ended (a Good job, the third
  try, Skip or Next), or passed by (C4). The line goes at once, and the
  server hears a skip where the machine did not close the practice and no
  helper words were used, so a reload agrees; the Take's other moments do
  not take the answered ones' place (founder 2026-10-21: "the black lines on
  the ideal text are still there even though I walked through them"; their
  paragraphs opened the practise again).
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
- **F6** Buttons: "Record Take N" is the main button, with the grey "Close"
  under it; the ✕ beside ⋯ at the top closes the page too, both to the chat
  (founder 2026-10-21: the ✕ stays, on a computer the eye looks top-right;
  until then "Close" was the one way out); history is under ⋯.
- **F7** Rule 5: the Ideal Text is only what the speaker said in their
  latest Take; their helper words stay until they pick new ones; every old
  version stays in the history.
- **F8** Everything else on the page (how helper words look, the sheets,
  Presentation Mode, export): backend [`FOUNDER-LOCK-helper-words-2026-09-30.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/FOUNDER-LOCK-helper-words-2026-09-30.md).

### G · Sharing, before the next recording

- **G1** Asked when "Record Take N" is tapped, from Take 2 on, never before
  Take 1; the choice applies to the Take about to be recorded. "Before we
  start the new take!", "After all, it's about speaking publicly!" (regular
  weight) and "How big you want your audience?" (founder 2026-10-21: the
  app's words, "Do you agree to share your next take with others?" is
  history). In the Lounge the question leaves no bubbles: the choice, in its
  own words ("Only my community (Invita)", "General community", "Only me"),
  is one small line under that Take's recording, and "Record Take N" posts
  no bubble of its own (founder 2026-10-26, N192, question 3; until then
  "Record Take N", the question as one bubble and the choice as the
  speaker's bubble, #847).
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
  clips mixed into judging are the training corpus: the imported clips the
  coaches judge, under the corpus basis (CO2), and the licensed corpus
  (founder 2026-10-23, N119; until then the licensed corpus alone, which
  was empty). A speaker's answer on a training clip is never a label.
  Community answers are
  peer ratings, kept apart from the coach's, the speaker's own and the
  machine's (L3).

### H · How a moment is picked (backend)

- **H1** `services/willfidence.py`, `services/moment_pick.py`:

  ```
  willfidence(sentence) = S × W                 0 … 1
    S = voice_confidence (7 cues vs the speaker's own baseline)
    W = mean of: few fillers/hedges · fits the slide · holds together
  shown     = the two highest willfidence (S × W) of the Take, however
              low, at most one per ~75-word block, two on one slide
              allowed; clips with enough words rank before short ones;
              then a clip that holds the helper words its slide had when
              the Take was recorded ranks after the rest (N246);
              fewer than two only with fewer than two playable clips
              (N118, 2026-10-23)
  clip      = in each shown block, its highest willfidence clip that can
              be served, a frozen choice kept (N122)
  blocks    = when the two best share a block, the boundary between them
              moves so each has its own (40 … 120 words, never across a
              slide, never cutting a clip); a one-block Take is split the
              same way when each clip has 5 words or more (N118); with no
              such cut and no other block to show, the block is cut
              between the two at its most even boundary (N246)
  each      S ≥ FLOOR → praised, unless the words need help (H3) → the
              Clearer version, then its helper words (N113); S < FLOOR →
              corrected: the Clearer version
              when the words need help, else the voice Exercise (N108)
  highest   = of the two, the stronger voice (S); its bubble opens with
              the signed line (C2, N118)
  try       = Δ voice score (S) vs the original ≥ MARGIN (+0.05) → better
  plan      = on a plan (the-plan.md G7, N246 item 3): the two best, as
              above, and the clip where this week's level shows most
              (services/plan_walk.py), read on the two and on other
              blocks' clips: a third moment, or one of the two; always
              practised with the level's own practice, its line above the
              clip; no clip shows it → the two best; the level is the one
              the plan had when the Take was recorded
  ```

  The unit is the sentence. FLOOR is 0.6 at launch, then calibrated so
  about 7 in 10 blind judges say 👍 to praised sentences. Only the praise is
  sent as "green"; the practise target goes out with no label; the level goes
  out as `level_key` ("W1".."W10"), never the number. A clip with no sound
  read is given the middle of the sound scale and the words order the clips;
  processing logs why nothing was stamped (2026-10-17).
- **H2** The AI clip's problem (pace, pause, stress, fillers) is measured
  against the speaker's own usual delivery; the clip is made once per
  exercise, at the end of the bake, checked before it is shown, and made
  once more with a new seed when it fails its check, never a third time
  (N93; a failed one is never shown, and a try after it is not scored); the walk asks
  for it after its first minute and shows it whenever it lands. The speaker's
  AI voice is made from Take 1 as the spoken Take is stored, beside its
  processing (N84; it used to wait for the end of processing). The whole
  rule: [`FOUNDER-LOCK-ai-voice-practice-2026-10-12.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/FOUNDER-LOCK-ai-voice-practice-2026-10-12.md).
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
  the same words). Both halves read the words the speaker sees, the Ideal
  Text's own words after the silent smoothing, so hesitations ("um", "uh")
  that never reach the screen neither make the words need help nor make a
  rewrite a real fix; they reach the speaker only through the AI clip's
  fillers tip (founder 2026-10-23, N121; until then both halves also read
  the clip's raw transcript, hesitations included). Anything else → the voice Exercise, for a voice under the
  floor only; a voice at the floor is praised instead (N108). For undermining words
  a rule writes the clearer version (`take_feedback_manager.
  _sentence_rewrites`): the same sentence with its apologies, asks for
  permission, self-doubt and softening hedges left out, never a word added;
  a playing-down phrase that would need rewriting makes no rule rewrite, and
  the moment keeps the voice Exercise. For a sentence that hedges and does
  not undermine, a rule writes it too (N112, 2026-10-21): the sentence with
  its softening hedges ("I think", "maybe", "kind of") left out, never a word
  added; a hedge's words that are not a hedge where they stand ("I think
  about it", "this kind of problem") stay. It carries no `rewrite_reason`,
  so it opens with C5's "Here is a slightly more polished option:".
  Four more signals, each written by a rule that only takes words out
  (founder 2026-10-23, N124, on his own Take 4, where the four rules above
  found nothing a coach would have left): **a restart**, a phrase begun and
  begun again at once in the same sentence ("if you could be just, if you
  could just, help me"), keeps the last attempt; **an approval tag** at the
  end of a sentence (", okay?", ", right?", ", you know?", ", yeah?") goes
  and the sentence ends on a full stop; **a playing-down "just"** ("is just
  a job", "if you could just", "I just wanted to") goes, never where "just"
  means a time or an exactness ("just now", "just in time", "just before",
  "just as"); **a weak opener** ("So,", "And so,", "So yeah,", "Well,") at
  the start of a sentence goes, never "so that" or "so far". A restart, an
  approval tag or a playing-down "just" makes the words need help on its
  own, as an undermining word does (the approval tag and the "just" open
  with B10's line, as undermining words do); weak openers count with the
  fillers (3 or more per 100 words). One rewrite per sentence carries every
  rule at once, so a sentence rewritten for one reason loses its weak
  opener too; a rewrite is a real fix when it removes any of them. A
  deliberate repeat across sentences ("I will say it again. …") is never
  touched.
  As built (2026-10-23): a restart is an attempt of two to six words begun
  again at once with its first two words or more, its other words small
  ones or said again, so two things said the same way ("we need vitality,
  we need emotions") stay; the "just" goes after "is", "it's", "I'm" ("I'm
  just trying to"), after an ask ("could just", "can you just") and before
  a wish ("I just wanted to"), and stays before a time ("just came", "was
  just leaving") and at a sentence's start ("Just do your work"); "So"
  without its comma is an opener only where a clause starts after it ("So
  we", "So where"). On the founder's Take 4 the rules write six Clearer
  versions: four for the "just"s and the "okay?", two for a "So," alone.

### I · Learning

The whole picture, every source the app learns from and how an answer
becomes a label, is one backend page: [`docs/LEARNING-AND-QUORUM.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/LEARNING-AND-QUORUM.md) (N102).
I1 to I5 are this flow's part of it. The two things it found open here, I1's
"half praised and half low" and I3's "200 labels", the founder settled on 21
October (backend N111).

- **I1** Labels come only from blind answers: the coach, and other speakers
  inside practice. 👍 = 1, 😐 = 0.5, 👎 = 0. A label counts once two answers
  match. "Audio unclear" goes to a fresh judge; twice, and the clip is
  quarantined.
- **I2** The speaker's own answers are never labels (L3). The AI clip is
  never a label and never enters a training set. The coach never sees the
  machine's guess before answering.
- **I3** Training tunes the willfidence weights against the soft label once
  there are at least 200 settled clips (two matching answers each, I1),
  speaker-disjoint, checked on the sealed
  golden set and re-sealed under the new question version; the founder
  promotes it as `willfidence-v2`. Coaches answer with the same 👍 😐 👎,
  "Audio unclear" and the signed "Skip"; old answers stay.
- **I4** Will learns about each speaker: every answer and every Take's
  outcome is kept (`services/speaker_memory.py`, [`docs/SPEAKER-MEMORY.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/SPEAKER-MEMORY.md)).
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

- **Said fresh, from the signed meaning** (founder 2026-10-23, N123: "please
  do not make the asks fixed all the time, please make them fairly smart
  like there should be some flexibility"; then "both"). Each ask after the
  Take (E1, E2, the CEO panel's included) and each of the walk's own lines
  (the AI clip's opener, tip and closer; the Clearer version's opener and
  question; Line A; the not-yet and move-on lines; Line B and "Does this
  sound confident to you?") keeps its signed line below as its anchor. Will
  says it fresh for this speaker and this Take (their name, their talk, how
  the Take went, what was said before), one or two short sentences, never
  the same wording twice in a row. A check keeps it only when it still
  means the signed line, carries no number or score, keeps the speaker's
  own words and quoted phrase, and stays short; otherwise the signed line
  shows. The walk's lines are written once per Take while it is processed,
  so the lens and the chat say the same and nothing waits. Never varied:
  buttons and tap answers, the praise lines (N122), consent and sharing
  words, the legal lines, the AI clip's label "AI version of your voice",
  "We couldn't hear that clearly. Try again.", the safety reply.

- **The tempo step (N179, signed 2026-10-26):** the bar "Tempo"; Will's
  opening "That part went fast. 🏃 Let's try a little game." (rushed) or
  "That part slowed down, with long pauses. 🐢 Let's try a little game."
  (slow), "Tell me more about {topic}, and keep the ball in the green."
  ({topic} the backend's few words, else "that part"), "🤫 Find a quiet spot
  first."; the buttons "I'm ready", "Skip", "Stop", "Practise again",
  "Next"; the speaker's bubble "Try 1" to "Try 3"; after a try "Better.
  You let it breathe." · "Still rushed. Take a breath after each offer." ·
  "A bit slow. Keep the words moving between the pauses."; a try that
  lands "That landed. 🎯 Really better. Let's move on."; while a try is
  left, under "Better. You let it breathe.", "You're close. 💪 Give it one
  more try." (both signed 2026-10-28, N245); the close "Dynamic. You paused
  where it mattered. 🔥" · "Still rushed. Give each offer its own breath
  next Take." · "Slow. Keep the words
  moving between the pauses."; a blocked microphone "The microphone is
  blocked. Allow it for this site in the browser's settings, then try
  again." In code: `TEMPO_COPY`, `src/lib/willab/tempoStep.ts`.
- **The walk's labels:** "Your coach:", "Continue", "Next", "Good job",
  "Skip", "Practise", "Practise again", "Stop", "Close", "Continue review",
  "Slide N", "Slide N · helper words", "Take N", "Other speakers",
  "Other speakers · N of N", "Practise N", "🔒 Take N", "Processing your
  recording", "Later · from your coach", "Updated with your coach's note ·
  see / hide the earlier version", "✓ Practised" (the one ✓ line, signed
  2026-10-21).
- **The chat's Feedback walk (N192, the founder's own words, 2026-10-26):**
  "Feedback walk" on a Take's one bubble, with the Take's date; "Edited"
  before that date and at the end of a changed bubble in the walk (B13).
- **Helper words:** "Choose your helper words", "N of 8 words" (the cap,
  eight since 2026-10-15), "Use these helper words", "Edit the helper words" (signed 2026-10-21), "Keep these".
- **A try not heard:** "We couldn't hear that clearly. Try again." (signed
  2026-10-21).
- **The coach's link in another account:** "This link is for another
  account.", "Log in with that account" (signed 2026-10-21, WIL-93).
- **The Clearer version:** "Here is a slightly more polished option:", "Do
  you accept and want to practise it?", "Accept and practise", "Keep my
  words"; for undermining words B10's "Say what you mean. Don't dance around
  it, just say it straight." and B13's "Try saying it like this:" (signed
  lines in a new place, N85).
- **Hello (N120, signed 2026-10-23):** "Hi {name}, good to see you
  back!", on Take 1 "Hi {name}, great to meet you!"; with no name "Hi, good
  to see you back!" / "Hi, great to meet you!".
- **The praise sentence (N120)**, signed on 2026-10-23, was dropped the same
  day before it was built (N122): the praise keeps its lines below.
- **The AI clip's bubble (N120, signed 2026-10-23):** openers "Nice.",
  "Close.", "Good."; tips, each followed by ", like this:": stress "Say
  “{phrase}” stronger", "Lean on “{phrase}”", "Push “{phrase}” a little
  more"; pause "Pause before “{phrase}”", "Take a breath before “{phrase}”",
  "Let “{phrase}” wait a beat"; pace "Slow it down a little", "Take your
  time", "A bit slower"; fillers "Say it without the ums", "Straight
  through, no ums", "Drop the ums"; nothing off "Lean on “{phrase}”", "Give
  “{phrase}” more weight", "Say “{phrase}” a little stronger"; then "Your
  turn." (the first bubble) or "Try again." (after a try that is not yet
  better). "Nice." or "Good." opens the first bubble and "Close." the one
  after a try that is not yet better, as the signed review page shows; each
  bank rotates, never the same line twice in a row (built 2026-10-23, the
  backend's signed line bank, "The AI clip's bubble"). The clip keeps its
  label "AI version of your voice".
- **Praise:** "This was your most confident moment." and "This was your
  most confident moment so far." (signed 2026-10-20; the second is replaced by
  the confident moment's own lines, `TOP_MOMENT_LINES` in
  `idealEditCopy.ts`: for a clearer version "This was a solid, confident
  moment we recognised. Let's make it even better." / "We picked this one out
  as solid and confident. A small change in the words could make it even
  better." / "This one stood out as solid and confident, and it can get even
  better."; for an example "This was a solid, confident moment we recognised.
  Here is an example to make it even better." / "We picked this one out as
  solid and confident. Listen to how it could sound even stronger." / "This
  one stood out as solid and confident. Here's how it could land even
  better."; with no example "This was a solid, confident moment we
  recognised. Say it once more, even more sure of yourself." / "We picked
  this one out as solid and confident. Give it one more go and own every
  word." / "This one stood out as solid and confident. Say it again and make
  it even stronger." (founder 2026-10-21, variations around the founder's
  line, to be confirmed in the PR).
- **Practise:** Line A "Say this one like your confident moment."; "That
  sounded more assured than the first."; the praise, not-yet and move-on
  lines of the signed bank (backend [`docs/SIGNED-line-bank-2026-10-06.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/SIGNED-line-bank-2026-10-06.md),
  `services/line_bank.py`); the opening lines W1–W10
  (`src/lib/willab/praiseLevels.ts`); the AI clip's L1–L18 (backend
  [`FOUNDER-LOCK-ai-voice-practice-2026-10-12.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/FOUNDER-LOCK-ai-voice-practice-2026-10-12.md)).
- **Other speakers:** Line B "Now one moment from another speaker." / "Now N
  moments from other speakers." / "Now one moment from {community}."; "Does
  this sound confident to you?"; "Yes", "In-between", "No", "Audio unclear".
- **Sharing:** "Before we start the new take!", "After all, it's about
  speaking publicly!", "How big you want your audience?", "General
  community", "Only my community", "Only me", "+ Add a community with a
  passcode".
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
- **The Sunday note and life goals:** their words are on [`principles.md`](principles.md) §1 K (N182).
- **Signed, no longer shown:** "Judgement time!", "If you are honest when
  judging others, it will help you find your confident voice and calm the
  inner critic 😌", "More about self-modeling theory", "I am going to judge
  them honestly", "Not sure", "Moment N of N", "It was better, and I have
  yet another practice for you to try!", "Exercise" and L2 "Here's how you
  could say it." as the Exercise's opening (L4 took their place, N82;
  "Exercise" on the video path too, 2026-10-21), "Clearer version" over the
  Clearer version and "Tap the words" over the picker (2026-10-21), and
  "Tap the words" under the chat's helper-words bubble (N192); "✓ You
  accepted and practised it", "✓ You kept your words", "✓ Skipped", "✓
  Answered" and "Do you agree to share your next take with others?"
  (2026-10-21); and the AI clip's L3, L4, L5 and L14–L18 in the walk
  (2026-10-23, N120); the tempo step's "See how it went" (2026-10-28,
  N245: Will decides when the game ends). The praise keeps its own lines
  (N122: the one-sentence praise of N120 was dropped before it was built).

### L and M · The Sunday note and life goals

Moved to [`principles.md`](principles.md) with their letters (backend N182):
the principles are their own feature, ring 6, apart from the speaking coach.
The walk, the plan, the coach panel and a Take's feedback never read or show
them.

---

### T · The tempo step (the pace step)

Founder 2026-10-24 to 2026-10-28, backend N162, N166, N179, N181, N245. Built: the founder and whoever the rings panel's `tempo_step` row reaches see it (§2 says what is left). Everything about this feature is in this block; it moved here from §2 when its build steps were done (docs audit, 2026-10-26).

**In one line.** After a Take where the speaker rushed or dragged, the walk
plays that stretch back and asks them to talk about the same thing again
while a dot on a scale follows their pace live.

**Where and when** (N162, N178).
- In the Feedback walk only. Never in the coach panel, the Lounge, or before the Take.
- It sits before the Ideal Text, so it always has a Skip, and the whole walk has a time limit (N178, which replaces N130's "never between a Take and the Ideal Text" for the walk's own practice steps). Open: the limit; the founder sets it (§3).
- It shows when the diagnosis and the plan say so: in a pace or pause week, from Take 2 ([the plan](the-plan.md), item 5). A speaker without a plan gets it from Take 2 whenever the pace scale finds a stretch outside the green, once in that walk (N181).
- It is the founder's "Sniper": the pace exercise of N129. The old Strength/Pace dartboard stays retired (N127, N181).

**The scale.** A dot on a horizontal line. It moves right while you talk
and left while you pause. Green in the middle, orange towards the ends,
red at the edges. No number, ever (Never 1). How the dot moves is settled:
backend N142, `docs/SPEC.md` §17 `pace-scale-v1`.

**The step, in order** (as drawn in [Tempo in the Walk](https://claude.ai/artifact/VJd5MeFGgZy7e3Q8M1EQXV)):

1. The speaker's clip, with the rushed or dragged stretch marked.
2. Will's bubble, from what the stretch was: "That part went fast. 🏃 Let's try a little game." or "That part slowed down, with long pauses. 🐢 Let's try a little game."
3. Will's bubble with the stretch's topic: "Tell me more about {topic}, and keep the ball in the green."
4. Will's bubble: "🤫 Find a quiet spot first."
5. The scale, asleep, and **I'm ready**. Tapping it wakes the scale and starts the recording bar. Nothing else appears until Stop.
6. The try: the dot's path, then Will's word on it; Will guides, the speaker never has to choose between another try and moving on (N245):
   - **It lands** (really better): "That landed. 🎯 Really better. Let's move on.", then **Next**; the game ends there, on any try.
   - **It came closer** (more than half in the green, not enough to land): "Better. You let it breathe." and, while a try is left, "You're close. 💪 Give it one more try.", then **Practise again**.
   - **Not yet**: "Still rushed. Take a breath after each offer." / "A bit slow. Keep the words moving between the pauses.", then **Practise again**.
7. After the third try without a landing, a one-line summary (for example "Dynamic. You paused where it mattered. 🔥"), then **Next** and the walk goes on. The Skip stays at the start and during each try (N178 item 3).

Once the walk goes on, the game stays in the thread as it was played (B5): each try with Will's word on it and the closing line (none after a try that landed), or the speaker's "Skip" as their own bubble; the scale shows only while the walk stands on the step (founder 2026-10-28).

**Decided** (the founder, N166 and N179; each as the prototype draws it):

| Question | Decision |
|---|---|
| Every word above | Signed, listed in §1 K (N179) |
| Which stretch | The one the scale reads furthest from the green |
| Where in the walk | Right after the practise moment |
| How many tries | Up to three; a try that lands ends the game (N245) |
| When a try lands | 20 s or more from the first word, four fifths of it in the green (N245). The Take's stretch was at least a quarter outside the green, so a landed try is always clearly better. A shorter try can't land: the ball needs about 10 s of talk without a pause to leave the green |
| When a try came closer | More than half of it in the green (N245) |
| A noisy room | The quiet-spot line only; no listening check |

**The build, in order** (N166 item 5):

| Step | What | Where it stands |
|---|---|---|
| 1 | The meter and the scale move from the bench to shared code; the walk gets its list of interventions, empty by default | Built |
| 2 | The step's screen in the walk, founder-only, on a stand-in stretch (the beds for sale) | Built |
| 3 | The Take's own stretch, its reading and its topic: the backend replays the pace scale's rules over the Take's word timings and takes the clip furthest from the green; the topic is one small-model call under the Take's processing authorization, else "that part"; no stretch, no step | Built |
| 4 | Kept: the step's lines, each try and its comment, and the closing line are Lounge messages like every other step; the game (the stretch's reading, each try's result and the dot's path, how it ended; never audio) is one speaker-memory event, so Will's note learns it in words | Built |
| 5 | The words signed (N179) and listed in §1 K | Built |
| 6 | Who sees it: the founder, and whoever the `tempo_step` row in the rings panel (`/admin/rings`) reaches; no row, nobody else. The backend answers the step only to them. The ring is widened, then turned on for everyone: a speaker without a plan when the Take needs it, a speaker with a plan in a pace or pause week (N147, N181) | Built (the plan part waits on the plan; the speaker without a plan needs no build) |

**The code.**
- The plan: `src/lib/willab/walkPlan.ts`, `WalkIntervention` and the `tempo` step key. A new intervention is a new kind there, its place in `buildWalkPlan` and its screen.
- The step: `src/components/willab/walk/WalkTempo.tsx`; what a try means, when it lands and what Will says to it (`readTry`, `landed`, `afterTry`) and the signed words (`TEMPO_COPY`): `src/lib/willab/tempoStep.ts`. A landed try is kept for Will as a better try and the game as ended dynamic (the backend's words for the game are unchanged).
- The meter: `src/lib/willab/pace/` (`paceSignal.ts`, `paceMic.ts`); the scale: `src/components/willab/pace/PaceScale.tsx`.
- The stretch: backend `services/tempo_stretch.py` (route `GET /v2/explore/arc/<arc>/review/tempo/<take>`), asked once per Take by `useReviewTempo.ts` through `src/services/api/reviewTempo.ts`. The scale reads slow only on pauses of several seconds, so most stretches it picks are rushed.
- What is kept: backend `POST /v2/explore/arc/<arc>/review/tempo/<take>` (`tempo_stretch.keep_tries`, a speaker-memory event of kind `take` with its `tempo` part, docs/SPEAKER-MEMORY.md), sent by `postTempoGame` in `src/services/api/reviewTempo.ts` when the game ends.
- Who sees it today: the founder's account, and anyone the rings panel's `tempo_step` row reaches (`useDeckFeedbackWalk.tsx`, `useRingState`; backend `tempo_stretch.tempo_is_on`). To try it on the dev harness: `/dev/feedback-walk?live=1&tempo=1` (the stand-in stretch).
- The founder's bench, `src/app/admin/pace-circle/`, uses the same meter and scale.

**History.** The [Pace Circle brief](https://claude.ai/artifact/VJ2uSugQWmbAsmReyxuufz)
(2026-10-24, N130, N133): a circle with three reads, replaced by the scale (N142).

## 2. In flight

One line per piece of work: `item · what it is · the rules it touches ·
where it stands · PR`. The session doing it fills its line in its PR and
deletes the line when the work is merged (the change goes to §6).

- **N171, N189, N193** · messages: a reply other than STOP is forwarded to the founder by email (STOP is built, N237), with no check message when a number is saved, since the app shows it back; coach-feedback messages wait from 21:00 to 8:00 in the time zone of the speaker's country of residence, and in the United States go only between 11:00 and 21:00 New York time (C1's doors) · C1 · decided, not built · BE #1326, #1360, #1367

- **The plan** (backend N129 onward) · the diagnosis, the plan card, the practice days and the plan's end have their own page, [`the-plan.md`](the-plan.md); it meets this page in the Lounge, in the walk's level moment (C, N134 item 2), the bar on the end sheet (N140 item 11) and the pace practice in a pace week (the tempo step), and in the chat's day line before each day's first message (N169, the-plan.md G3) · decided, not built · its rules live there, not here (backend N160). Built, on for ring 5 since 27 October 2026 (N203, N204, backend #1394): the plan in the Lounge, and the bar with "{n} of {total} practices done. Next: {day}." on the walk's end card (`WalkEnd.tsx`, `PlanProgress`); and since 27 October the level's moment in the walk (H1, N209: "This week's level: {level}. Here's where it shows:" above the clip, `LevelHere` in `FeedbackWalk.tsx`)

- **WIL-76** · the stale processing step (urgent) · A1, A2 · confirmed in the app 2026-10-20 ("it doesn't open right after the processing"). Built: the marks are baked in the run right after ready (BE), the processing bubble waits for them and the page keeps asking for late marks to its ceiling and closes its slot when it stops (FE) · BE #1209, FE #896 · the founder checks the app
- **WIL-89** · the lens as one chat: the opening order, the lenses, the interventions × chat awareness · B, C1, F · built and merged: FE #868, #882, #885, #886; BE #1170, #1190, #1194, #1196. Whether it works as drawn is the founder's check in the app ("success?") · to confirm
- **WIL-84, WIL-86** · videos match (the coach's changed word and video, N80) · C1, D5 · built and merged: BE #1160, FE #861, FE #872 (the speaker's side). One backend follow-up stays: a later change of the coach's word updates the in-review bubble in place (D5) · to confirm in the app
- **WIL-90** · the exercise is blocked · C6, C7 · BE #1206 fixed the coach's gate; built 2026-10-20: the Manager's exercise offer, the verbal-cue gate and the error-presence audit read the speaker's own page too · BE #1209 · the founder checks the app

The four lines above were filled from main's history by the page's keeper on
2026-10-20; the sessions doing the work overwrite them when they push.
- **N123 · the asks and the walk's lines said fresh** · E1, E2, K · founder 2026-10-23 ("please do not make the asks fixed all the time, please make them fairly smart like there should be some flexibility"; "both"). To build: one call per ask and one per Take for the walk's lines, under the Take's processing authorization, kept only past the check (the same kind as `will_question.vary`), the signed line otherwise; stored with the Take so the lens and the chat agree; never twice the same wording in a row per speaker · decided, not built · the founder checks the app
- **N77 · the coach's link names the word's Take** · C1 · founder 2026-10-21 ("the links carry the Take the word was written on, and open that Take's coach-only walk with the word"). Found: with the earlier-Take fallback gone (BE #1212), the WhatsApp and email links open the latest Take, where an earlier Take's late word is no longer served. Built: the links carry `&take=<session_id>` (BE); the chat page reads it, the Ideal Text asks the journey for that Take and the coach-only walk opens on its word; an earlier Take's link shows that word alone, with no moments of the latest Take (founder 2026-10-21); without it, as before (FE) · FE #905 merges first, then BE #1212, then FE #903 · the founder checks the app
- **N92 · the coach's video reaches the walk** · C1, D5 · founder 2026-10-21 ("the video was sent too with the coach feedback and didn't pass through"). Found: the speaker's feedback rows are served from a stored bake that only the speaker's own writes retire; the coach's answer, with its signed video link, stayed as baked, so a video added after the bake never arrived and a baked link went dark after six hours. Built: the bake re-reads the coach's answer on every read, one read per Take, the video signed afresh; a coach's share asks for one rebake (BE) · BE #1213 · the founder checks the app: the coach's bubble in the walk shows the video above the words
- **N91 · the walk as one thread, from every door** · B5, B9, B10, F3 · founder 2026-10-21, two recordings (the app at 06:29; the prototype, "this is how it should be"): a door opened a lone fragment of the walk, the helper words opened from the Lounge did not scroll on to the next step, Next closed the walk instead of moving on. Found: the thread was drawn only up to the step the walk stood on, and the dock was always the newest part's. Built: the thread holds every part up to the walk's furthest; the step a door names stands with its own buttons and is brought to the top; Next moves on to the next part, after the last onto the page; scrolling and ‹ › move through every part; "Review feedback" opens the whole finished walk on its newest step (FE) · FE #899 · the founder checks the app; open: what was missing of the coach's feedback in the walk (the video, the fragment's audio, or the rest of the walk)
- **N90 · the walk's doors, checked in the app** · B10, C1, D5, F4, F5 · founder 2026-10-21: a coach's bubble and an Exercise bubble in the Lounge opened the Ideal Text page, not the walk; "the WALK opens up immediately on that part, but you can scroll to previous parts or scroll to the next ones". Found: on a finished Take the door looked for the step in the live walk, which holds only its tail, and the page asked for the walk before the Take's marks had landed; both fell back to the text. Built: a step already answered past opens the walk as given on that step, the parts before and after it there to scroll, the newest moment's part at the end with the dock; the page waits for the marks before it asks (FE) · FE #898 · the founder checked the app the same morning: the dock belongs to the step itself and Next moves on, N91
- **N90 · the coach's bubble at the bottom** · D5 · founder 2026-10-21 ("it should be at the bottom, like it's a new message"). Found: a word shared during the review was never written as its own bubble, so it reached the chat only as the walk's copy among the Take's steps. Built: the "Later · from your coach" bubble is written the moment the coach shares, review ended or not (BE) · BE #1211 · the founder checks the app
- **N90 · a try not heard; Edit the helper words** · C3, C7, K · founder signed both lines 2026-10-21. Built: the walk says "We couldn't hear that clearly. Try again." with Practise again and Next on a 422 from the server; an answered helpers step's pill reads "Edit the helper words" (FE) · FE #898 · the founder checks the app
- **N89 · one mechanism opens the walk** · B10, C1, D5, F4, F5 · founder 2026-10-20 ("the SAME WAY", "THE SAME MECHANISM"). Built: every door (a paragraph with or without the line, a Lounge bubble, the coach's word) opens the whole Take's walk at its step through one path; the narrowed walk, the finished walk with no buttons and the coach's own lens are gone · FE #897 · the founder checks the app; the "edit the helper words" wording signed 2026-10-21 (N90)
- **N89 · the chain after the Take** · D3, D4, E1, K · founder 2026-10-20. Built: the summary without the next step and without the CTA; the closing message held behind the chain, each ask in turn with Will's lead-in, "Did this help?" when the Take looks off, then "Look, practice makes perfect…" with Record Take N (BE); the Lounge reads the closing message as the held row and puts the CTA under it (FE) · BE #1210, FE #897 · the founder checks the app. Choices made and confirmed 2026-10-21: "Did this help?" keeps its "looks off" condition and comes last; Take 1 still skips WhatsApp and the CEO panel's asks; the CEO panel's asks and Will's own question get no lead-in
- **The rewrite does not appear** · C4, C5, H3 · founder 2026-10-20, and again 2026-10-21 (N112, "There was no single rewrite in the take"). Found 2026-10-20: the served rewrite row carried no block id, so the walk drew it as a moment of its own and the Clearer version never attached (BE); a corrected moment with neither rewrite nor exercise was dropped instead of said again (FE). Both built · BE #1209, FE #896. Found 2026-10-21: the shown moments are the two strongest voices (N108), and a strong voice whose words needed help for their hedges had no rewrite inside its clip (the AI writes one only for a clip read unconfident, rude or off the slide; no rule wrote hedges), so it was praised. Built: the rule of N85 also leaves out a sentence's hedges (H3) · BE #1258 · the founder checks the app on a Take that hedges
- **The AI voice bubble loads, then disappears** · C6, H2 · founder 2026-10-20. Found: a failed clip cycle is final and its real failure code was lost (a permit refusal stored as its class name); BE #1209 keeps the code and retries a permit the service could not read once. The founder read the row on 2026-10-21: a stress clip, made once, came out flat (0.02 dB of contrast; the two stress clips that passed had about 2.4) and failed its check (`validation`, `not_stressed`). Built (N93, founder 2026-10-21, "One more try"): a clip that fails its check is made once more with a new seed (`AI_VOICE_GENERATION_RETRIES` 1; 0 on Railway turns it off), and a try after a clip that was never made is no longer scored, so it can't hold the problem back for the speaker (BE) · BE #1209, BE #1214, FE #902 · the founder checks the app
- **The coach's bubble did not open** · C1, D5 · founder 2026-10-20. Found: the walk's own copy of an earlier Take's word was tapped as a step and opened nothing (or a read-only review); the "Later" bubble opens the lens. Built: every coach bubble opens the coach's word in the lens, Close marks that word's Take, and a lapsed video link is refreshed · FE #896 · the founder checks the app
- **Helpers open as a separate single action** · C3, F5 · founder 2026-10-20. Found: the Lounge's helper-words bubble opened before the marks were in, so a paragraph with a moment showed its words alone. Built: it waits for the marks unless the paragraph already has its moment · FE #896 · the founder checks the app
- **The card lands between the data question and its buttons** · D4 · founder 2026-10-20. Found: the admin's asks were stamped only with the message they wait for, so the card was not moved above them. Built: the ask carries its Take, and the order resolves older asks through the message they wait for · FE #896 · the founder checks the app
- **The lens scrolls** · B2, B5 · founder 2026-10-20 ("It is scrollable!"), read as WIL-89 working as drawn; say if that was a complaint · confirmed
- **Review from the Lounge loads very long** · F1, A2 · founder 2026-10-20. The same cause as WIL-76: the marks computed live (20 to 40 s) or pending behind a queued bake; the bake in the run stores them before the Take is ready, so the tap finds them · BE #1209 · the founder checks the app

- **Tempo · the pace step** · §1 T · built; it reaches the founder and the `tempo_step` ring. Left: widening the ring, then turning it on for everyone (N181), and the plan's pace weeks, which wait on the plan (N147) · the founder decides when

## 3. Still open

- **The walk's time limit** (N178): the whole walk, the tempo step included, gets one; the founder sets it.

- **Tempo step**: its questions are decided (§1 T); only the walk's time limit above is open.

- **Self-judgement of your own practice try** is off for launch (2026-10-12):
  4 speaker answers, 21 clips with coach answers, 1 with both. Re-run the
  query pack's `1-enough-data.sql` once `clips_with_both` reaches about 50,
  then show the founder the numbers; the founder decides (confirmed
  2026-10-20).
- **WIL-32 · the speaker/coach disagreement signal** (founder 2026-10-21,
  N97; backend [`docs/DESIGN-WIL-70-disagreement-signal-2026-10-18.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/DESIGN-WIL-70-disagreement-signal-2026-10-18.md) §6):
  a clip where the speaker and the lone coach disagree goes first to a
  second blind listener. It waits until speakers answer about their own
  clips again; judging your own moments stays out of the walk (C10).
- **A Stop tapped before the mic has started** may leave the typing dots
  up and the mic on (read in the code 2026-10-20, not reproduced): the
  recorder's stop does nothing until the mic reports started.
- **Two moments on one slide share its helper words** (found 2026-10-23,
  building N118's core): helper words are kept one set per slide (the
  recording screen reads them per slide), so when both shown moments sit on
  one slide and both voices reach the floor (N113), words picked at the
  second replace those picked at the first. Nothing changed; the founder
  decides whether that stays.
- **FLOOR** is 0.6 until the blind judges calibrate it (H1).
- **willfidence-v2** waits for 200 settled clips (I3).

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
- `src/components/willab/useWaitScreen.ts`, `src/lib/willab/waitHandover.ts`
  — the waiting screen from the Lab's hand-off to the walk's first step
  (A1, A2).
- `src/lib/willab/walkMotion.ts`, `src/lib/willab/walkLines.ts`,
  `src/lib/willab/praiseLevels.ts`, `src/lib/willab/walkPractise.ts`,
  `src/lib/willab/walkTries.ts` — motion, the line rotation, the opening
  lines, the practise loop, the tries.
- `src/components/willab/useDeckFeedbackWalk.tsx` — how a paragraph tap
  opens the walk and the coach-queue report (F4, F5, I5).
- `src/components/willab/NextTakeShareScreen.tsx` — sharing the next Take (G) (guarded since N111).
- `src/lib/willab/coachLink.ts` — the coach's link (WIL-93) (guarded since N111).
- `src/components/willab/OtherAccountLink.tsx` — the coach's link on another account (WIL-93) (guarded since N111).
- `src/lib/willab/enrichmentSettle.ts` — the wait for the Take's reading to settle (A2) (guarded since N111).
- `src/components/willab/TypingDots.tsx` — Will's typing dots (B8) (guarded since N111).

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

The tempo step: its files are in §1 T, "The code".

Tests that hold the promises: `src/components/willab/walk/feedbackWalk.test.tsx`,
`walkPractise.test.tsx`, `walkReplay.test.tsx`,
`src/components/willab/deckFeedbackWalk.test.tsx`,
`src/components/willab/walkReachesCoach.test.ts`,
`src/components/willab/loungeNewCoachFeedback.test.tsx`,
`src/lib/willab/walkPlan.test.ts`, `walkThread.test.ts`, `lensScreen.test.ts`,
`waitHandover.test.ts`, `waitProgress.test.ts`;
backend `tests/test_speaker_memory.py`. Every test's story: `docs/TEST-STORIES.csv`.

## 5. Prototypes

The design is the prototype; the newest wins where two disagree.

- **Current:** the Feedback walk in the chat
  <https://claude.ai/artifact/Xb51mpaFDguFdBuL8Gjv18> (N192, 2026-10-26,
  version 5, decided; version 3 drew the two ways not chosen; version 6, the
  pair, N202, with "As built" to compare); the lens,
  the Ideal Text and the Lounge
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
  AI voice <https://claude.ai/artifact/G8Am3fR3f3SzAdTkwyUGKZ> (v8). The
  Sunday note's and life goals' prototypes are on [`principles.md`](principles.md) §5.
- **Tempo step:** its prototypes are in §1 T.
- **The base:** moment and feedback as one chat with a lens
  <https://claude.ai/artifact/TXbwmupWJio6N1gHqdEa7p> (version 27, locked
  2026-10-12; 31 final).
- **History:** the Feedback walk, 2026-10-06
  <https://claude.ai/artifact/C2CTBmU1bfSSDQgJUHTKkE> (version 10); the Ideal
  Text page and helper words, 2026-09-30
  <https://claude.ai/artifact/AeRVS91VUAiJLCePB82s3d>.

## 6. Changes

One line each, newest first: `date · N · what changed · PR`.

- 2026-10-28 · N245 · the tempo step (the Sniper) guides the tries: a try that lands (20 s or more from the first word, the ball four fifths in the green) gets "That landed. 🎯 Really better. Let's move on." and Next, on any try; one that came closer gets "Better. You let it breathe." and "You're close. 💪 Give it one more try."; otherwise its comment; up to three tries, then the closing line. Was: Practise again after every try, See how it went from the second, the close only after the third or on the speaker's choice (founder 2026-10-28: "If it was really better, you let me go to the next step") · BE (decisions log), FE (this PR)
- 2026-10-28 · — (B10, C3) · fixed: the Feedback walk whose newest part is helper words opens the whole walk standing on them, through the same door as every other step, once the Take's answers and tries are read. Was: it opened those helper words by themselves as soon as the page was up, before the tries were read, so words a Good job had opened (N220) were not in the walk yet and showed alone, under the hello, with nothing before or after (founder 2026-10-28: "When I click the feedback walk bubble, it just opens helper words") · FE (this PR)
- 2026-10-28 · — (B5, C8, T) · fixed: a step the walk moves on from stays in the thread as it was drawn: the tempo game's tries, their comments and its closing line (a Skip with no try as the speaker's "Skip" bubble), and other speakers' moments with the answers given, all there to scroll back to from the summary; the walk never stands on an earlier part's helper words while the tempo step's recorder is in the dock (B9). Was: moving on drew the step again from nothing, so the tempo game kept only its opening lines, down to "🤫 Find a quiet spot first.", and other speakers' moments left the thread (founder 2026-10-28: "I click next and it's gone, and should be stayed, should be there, should be in the walk, so that there is a continuity") · FE (this PR)
- 2026-10-28 · N246 · every Take shows two moments: a Take whose clips all sit in one block is cut between its two best when no 40-to-120 cut fits; a sentence holding the helper words its slide had when the Take was recorded gives its place to the next best; a moment the walk shows stays after helper words saved at the first of two on one slide; on a plan, the two best and the level's moment, the level now read on the walk the speaker sees too (C2, C3, H1). Was: a short Take showed one moment, the second of two on one slide left the walk once helper words were saved, and the served walk never read the level · BE #1459, BE (code PR), FE (this PR)
- 2026-10-28 · N244 · the last Take's closing message gives "Record Take N" up once the next Take is recorded, and the chat offers no Take until that Take's walk reaches its summary and its own closing message lands (D4). Was: the button was held only while the Take processed, then came back, naming the Take just recorded, beside the new Take's walk (founder 2026-10-28: "I can see two bubbles interfering … one for the new take and one the summary of the take I just took") · BE (N244 log), FE (this PR)
- 2026-10-28 · — (H1) · wording: a try is better when its voice score (S) rises by the margin, +0.05, over the original clip, as built (`after_practice.GOOD_JOB_MARGIN`) and as N84 says ("on the voice alone"); was "Δ willfidence", which reads as voice × words. No rule changes (founder 2026-10-28: "fix the doc wording to say voice score") · FE (this PR)
- 2026-10-28 · N237 · built: a WhatsApp reply that says STOP turns the messages off for every account at that number, as Remove does (the number it signs in with stays, N235), a booking that carries the number forgets it (N233), and WhatsApp answers "Done. We've stopped the WhatsApp messages and deleted your number." (signed, N174); any other reply is not read yet (N171 item 6). Off until its two keys are on Railway and the webhook is set in Meta · BE #1450, FE (this PR)
- 2026-10-28 · — (C3, B10) · fixed: helper words are editable on any part of the thread: a tap on a picker the walk does not stand on stands the walk there, the tap counts, and its buttons bring the walk back to where it stood; never while the recorder is in the dock (B9). Was: only the part the walk stood on took a tap, so a walk opened on a later step (the Feedback walk on its newest step) showed "0 of 8 words" pickers that did nothing (founder 2026-10-28: "I click the helper words, they don't mark on orange, so I cannot choose the helper words") · FE (this PR)
- 2026-10-28 · N235 · a full number typed in the chat under the WhatsApp ask waits for its code: Will says "Enter the code we sent you on WhatsApp" and the form opens on the code step; was saved at once (2026-10-20); a number another account has gets "That number already has an account." (E1) · BE #1446, FE (this PR)
- 2026-10-28 · N230 · the WhatsApp ask's number field shows the country by its flag, Poland first; Save sends a code on WhatsApp and the number is kept, for the messages and for signing in, once the code is typed; was saved at once with no code (N184 item 1) (E1) · BE #1438, FE (this PR)
- 2026-10-27 · — (B9, B10) · fixed: the dock gives way to the Next that brings the standing step back only once none of that step is in view. Was: whenever the bar named a later part, which it does for a standing part shorter than the upper 40% of the thread or a thread that fits in view, so a walk opened on an earlier step (a bare correction, a clip alone) lost its own buttons the moment it opened, and its Next scrolled nowhere (founder 2026-10-27: "when I review the feedback and click next nothing happens") · FE (this PR)
- 2026-10-27 · N220 · built: a correction whose practise ends on a Good job opens its helper words right after it, as a praise does; a moment gets them once, and a practise ending on the third try without a Good job gets none. Was: a correction's Good job went on with no helper words (lock 2026-10-12, §2.5), so a Take whose two moments were both under the floor had none (C3, C7) · BE #1428, FE (this PR)
- 2026-10-27 · N119 (C8) · fixed: an answer on another speaker's moment moves on to the next, as C8 says. Was: the chat counted the answer at once, the step took the new count for a judging reopened from the Lounge, loaded its moments again and stood on the typing dots for good (founder 2026-10-27: "it gets stuck on judgment time") · FE (this PR)
- 2026-10-27 · N209 · on a plan, the walk's second moment is where this week's level shows most, opening with "This week's level: {level}. Here's where it shows:" above the clip (signed, the-plan.md K) and practised with the level's own practice, on screen and in the chat; no clip shows the level, the two best; off a plan, nothing changes (H1) · BE #1406, FE #1024
- 2026-10-26 · N207 · the WhatsApp ask's form names the booked call: "We will only use it to let you know your coach texted you, or that your call starts soon."; the booking form asks for no number, and a booked call's reminder goes to the number saved here; was "… your coach texted you" (E1) · BE #1391, #1395, FE (this PR)
- 2026-10-26 · N140 item 11, N203 · the walk's end card shows the plan's bar and "{n} of {total} practices done. Next: {day}." between its title and its next step, for a speaker with an active plan; nothing for anyone else · BE #1386, FE #1018
- 2026-10-27 · — · B3, B10, B13, D4 and D5 rewritten to read easily: short headed bullets, the founder's words in one bracket at the end; no rule changed · FE (this PR)
- 2026-10-26 · N192 (B10) · fixed: the Feedback walk and "Continue review" always name where the walk opens; a finished walk asked for a step it does not hold, or for its summary, stands on its newest step. Was: a walk paused on its summary, or with no part to stand on, opened the Ideal Text instead (founder 2026-10-26: "the feedback walk opens the ideal text instead of the feedback walk!") · FE #1015
- 2026-10-26 · N202 · the Feedback walk and its Ideal Text card are one pair: the same width (80% of the chat, at most 384px), the card 3px under it with their left corners drawn in and no tail on the Feedback walk, together under the recording; while the walk runs, its "ready" card waits for the walk's end; the coach's "new" dot sits on the newest card drawn. Was: the Feedback walk as wide as its words (at least 190px), the card where the walk's end wrote it, and the "ready" card above the Feedback walk during the walk (B3, D4) · BE #1383, FE #1013
- 2026-10-26 · N192 · built: the Lounge draws a Take's walk as one "Feedback walk" bubble at its first step, with the walk's date and ›, "🔒 Take N" for an older Take and "Edited" once something in it changed; its card and the coach's "Later" bubble stay their own; the walk's other steps, the summary (kept where it carries "Record Take N", a Take before N89) and the sharing bubbles are not drawn; the sharing choice is a line on the recording; an outlined bubble is a 2px border with no tail; in the walk, "Edited" on helper words picked again, on the coach's changed word and on a summary a coach's note rewrote, with its earlier version; the walk shows the summary as the chat holds it, also when played again; Will reads the Feedback walk with the Take's summary in it; a coach's changed word keeps its bubble's place, marked edited (BE) · BE #1368, FE #1006
- 2026-10-26 · N171, N189 · built: one ask after each Take, the first that waits in E1's order, the others for a later Take; the WhatsApp ask can be Take 1's, the CEO panel's ask and the home screen from Take 2; was at most two a Take, and never WhatsApp after Take 1 (E1) · BE #1370, FE (this PR)
- 2026-10-26 · N192 · the chat shows a Take as its recording, one "Feedback walk" bubble with its date and ›, and its Ideal Text card; an edit says "Edited" in place; the summary, the coach's word from the walk and the sharing question leave the chat (the choice is a line on the recording); the outline a full stroke; the card alone with black lines on the text, and one card with a Feedback walk row, were drawn and not chosen; was: the same steps as chat bubbles, a step that asks locks and shows its answer as the speaker's bubble (B3); a bubble with › opens its step, "✓ Practised" over Next (B10); the Lounge says the lens's words, the AI voice's short bubble (B12); helper words editable from the Lounge's helper-words bubble, a new pick a new bubble and the old one struck through (C3); the summary a plain bubble under the card (D4); the walk's copy of the coach's word in the chat, a changed word moved to the bottom (D5); "Record Take N", the question and the choice as three bubbles (G1) · BE #1364, FE #1001
- 2026-10-26 · N189 · one ask after each Take, the first that waits in E1's order, the others for a later Take; was at most two (N94) (E1) · BE #1360, FE (this PR)
- 2026-10-26 · docs audit · the tempo step's block moves from §2 to §1 T, word for word, now that its build steps are done; §2 keeps one line for what is left; §3, §4 and §5 point to §1 T. Was: the whole feature in §2 · —
- 2026-10-26 · N161, N167 · B3 and D4 name the plan's record buttons: under the plan card, in place of "Type here", only "Start your first recording" (N161); on a practice day one record button in the chat, in the newest bubble, the closing message keeping its words and giving its button up (N167); the plan decided, not built. Was: "The Lounge has no record button, only the message box" (B3); the closing message keeping "Record Take N" under it, with no newer bubble named (D4) · —
- 2026-10-26 · N182 · the Sunday note (L) and life goals (M), with their words, in-flight lines and prototypes, moved to [`principles.md`](principles.md): the principles are their own feature, ring 6, apart from the speaking coach · BE #1344, FE #993
- 2026-10-26 · N181 · the tempo step is the founder's "Sniper"; a speaker without a plan gets it from Take 2 when the Take has a stretch outside the green; it reaches people as the `tempo_step` ring widens; was: only the plan's pace or pause week, later · BE #1344, FE #993

- 2026-10-26 · N179 · the tempo step's words signed and listed in K; was drafts shown to the founder only · BE (decisions log), FE (this PR)
- 2026-10-26 · N178 · the tempo step stays before the Ideal Text with a Skip, and the whole walk gets a time limit (open); helper words up to eight confirmed. Was: N130's "never between a Take and the Ideal Text"; the cap written as six in the contract · BE #1339
- 2026-10-26 · N172 · built (M1–M11): the ask after a # note with Not now | Start; "#goals" or an ask in your own words opens the lens; one goal per sitting, the open questions said with the small mic or typed, Will's draft quoting only your words, goal or want, ambitious, give up, the horizon worked back to the quarter with the four-week rule, the ladder in the Lounge with its ›, a step changed with its earlier words kept; the lens is the walk's frame (`LoungeLifeGoals.tsx`); the pair shows above the message box, as the notebook's and the WhatsApp ask's do · BE #1335, FE (this PR)
- 2026-10-26 · N166 · built: who has the tempo step is a ring, the `tempo_step` row in the rings panel, besides the founder; the backend answers the step and keeps the game only for them; was the founder only · BE (this change), FE (this PR)
- 2026-10-26 · N172 · life goals decided (M): asked once after the first # note and once more after the next, or whenever asked; one goal per sitting in a lens; drafted only from the speaker's words; goal or want; a horizon and the steps worked back to the quarter, with the four-week rule; the ladder; changing a step with its history; kept in the Life Panel · —
- 2026-10-26 · N171, N174 · built: the coach's doors send one message for a coach's sitting, 10 minutes after the last share, naming that Take: the WhatsApp when the speaker left a number, else the email (also when the WhatsApp cannot go), and none once the speaker opened the coach's feedback; was one WhatsApp and one email for every share (C1) · BE #1333
- 2026-10-26 · N166 · built: the tempo step writes the chat (its opening lines, each try and its comment, the closing line, or the Skip) and keeps the game for Will (each try's result and path, how it ended; never audio) as a speaker-memory event his note reads in words; was nothing kept · BE (this change), FE (this PR)
- 2026-10-26 · N171 · the WhatsApp ask from Take 1, once the Take has gone to the coach, first in Take 1's asks, "Did this help?" waiting rather than it; was: from Take 2, never on Take 1 (E1) · BE #1326, FE (this PR)
- 2026-10-26 · N166 · built: the tempo step runs on the Take's own stretch, the clip the pace scale reads furthest from the green over the Take's word timings, fast or slow, with its topic in a few words (else "that part"); with no clip outside the green there is no tempo step; was the stand-in stretch · BE (this change), FE (this PR)
- 2026-10-26 · N166 · built: the walk takes a list of interventions, empty by default, and the tempo step is its first: right after the practise moments, never in the coach-only walk or for a guest; its screen, founder-only on a stand-in stretch, with draft words; the pace meter and scale moved to shared code, the bench unchanged · FE (this PR)
- 2026-10-26 · N162 · the pace practice is the tempo step of the Feedback walk only, shown in a pace or pause week from Take 2; was: before the Take, 2 minutes, where it sat open · BE #1316, FE #969
- 2026-10-26 · N170 · the Sunday note (L1): on Sunday from 6 pm by itself when the last seven days of # notes show a pattern, and whenever asked, in any wording, understood by meaning; asked with nothing to find, one line saying so; was only when asked, by "sunday note", "#sunday" or "case of the week", read from the calendar week, with Will answering as usual when there was nothing · —
- 2026-10-26 · N158 · the Sunday note locked as a lens (L): only when asked, only from # notes, two bubbles and Not now | Investigate in the Lounge, the bug, the principle, the reflection and the new principle one step at a time in the lens, Accept or Edit; was the whole form in one bubble every Sunday at 6 pm, read from the Takes and the chat, with Old | New · —

- 2026-10-24 · N118 (second part), N128 · built: when the Take's two best clips share a paragraph, the cut between them moves so each gets a paragraph of its own (40 to 120 words, never across a slide, never cutting a clip), and a one-paragraph Take is split in two when each clip has 5 words or more; the paragraphs made are new ones with new ids, and a Take whose feedback is frozen keeps its paragraphs; also fixed, a frozen Take no longer loses a moment whose clip was not its paragraph's loudest (C2, H1) · BE #1284
- 2026-10-24 · N119 · built: other speakers are three moments every walk, one the machine reads high, one middle, one low, three different speakers, never the speaker's own or one they judged, in a blind order fixed for the Take; community clips first in their level, then the imported corpus the coaches judge (played by a short-lived signed link, audio only), then the licensed corpus; fewer only with fewer speakers or levels, and an empty or short set is logged with why; a speaker's answer on an imported clip is kept once in its own table, never a label; the walk asks with its Take and shows what the server sends, was one moment per try (C8, G4) · BE #1280
- 2026-10-23 · N120, N122 · built: the walk opens once with "Hi {name}, good to see you back!" (C0); a praised moment is practised with the AI clip's short bubble, a Good job ends it, then its helper words, and with no clip the praise stands on its own (C2); the AI clip comes in one short bubble, an opener, the tip for its problem quoting the speaker's phrase, the clip, "Your turn." or "Try again.", was L4, L3, L5 and L14–L18 (C6, C7, K); each new bubble and the typing dots land at the bottom and the thread follows, was the newest step brought to the top (B5); the Lounge says the same words (B12) · BE #1279
- 2026-10-23 · N118 (core), N121, N122 (the clip in a shown block) · built: the Take shows its two highest willfidence clips, one per block, two on one slide allowed, was the two strongest voices one per slide; the stronger voice of the two is the most confident, was the first; a shown block's moment is its highest willfidence clip that can be served, a frozen choice kept, was its strongest voice; both halves of the rewrite gate read the words on screen, was the clip's raw transcript too (C2, H1, H3) · BE #1278
- 2026-10-23 · N124 · built: the four rule signals (restart, approval tag, playing-down "just", weak opener), one rewrite per sentence carrying every rule, each counted by the gate and as a real fix (H3) · backend #1277
- 2026-10-23 · N125 · the six build questions settled: N118 in two parts, the core first; the walk builds' `Founder-Approved:` line; N123 on the small model Will already uses, one call a Take; N124 measured before tuned; the full stop between sentences (N126); the re-cut blocks' ids decided when N118's second part comes · no rule changes
- 2026-10-23 · N124 · four more rule signals for the Clearer version: restarts, approval tags, a playing-down "just", weak openers; was: hedges, undermining words, a broken sentence and repeated phrases only (H3) · decided, build in §2
- 2026-10-23 · N123 · every ask after the Take and the walk's own lines are said fresh around their signed line, checked, the signed line the fallback; was: Will's question with a light touch, the CEO panel's asks as written, the walk's lines from the signed banks only (E1, E2, K) · decided, build in §2
- 2026-10-23 · N122 · a praised moment is practised with the AI clip's short bubble, then its helper words, was "two praises and no practise" (C2); the praise keeps its three lines, N120's one-sentence praise dropped (C2, K); bubbles and dots land at the bottom and the thread follows, was the newest step brought to the top (B5); a shown block's moment is its highest willfidence servable clip (H1) · decided, build in §2
- 2026-10-23 · N121 · the rewrite gate reads the words the speaker sees, so hesitations never make the words need help or a rewrite a real fix; they reach the speaker through the AI clip's fillers tip; was: both halves also read the clip's raw transcript (H3) · decided, build in §2
- 2026-10-23 · N120 · a hello with the speaker's first name opens the walk (C0); the praise is one sentence built from the level, cue and closer pieces, was the title "This was your most confident moment." over the level line and the cue line (C2); the AI clip's bubble is one short bubble, an opener, one tip ", like this:", the clip and "Your turn.", was L4, the clip, L3 and L14–L18 under the player (C6); a try not yet better gets the same bubble with "Try again.", was a not-yet line and the clip with L5 (C5, C7); the words in K · decided, build in §2
- 2026-10-23 · N119 · other speakers: three moments every walk, one read high, one middle, one low, three different speakers, community clips first in their level and the training corpus (the imported clips the coaches judge, and the licensed corpus) for the rest, fewer only with fewer speakers; was "one moment per try, at least one and at most three: other speakers' moments first, licensed clips for the places left" (C8) and "the training clips mixed into judging are the licensed corpus" (G4) · decided, build in §2
- 2026-10-23 · N118 · the two best moments by willfidence (S × W), however low, one per block and no longer one per slide; the stronger voice of the two is the most confident; when the two best share a block its boundary moves, and a one-block Take is split in two; was "the two strongest voices (S, then S × W), at most one per slide (a one-slide Take shows one)", the highest the first in rank (C2, H1) · decided, build in §2

- 2026-10-22 · N113 · a moment whose voice reached the floor and whose words get the Clearer version keeps it and its practise, then its helper words, as after a praise; the server says which with `helper_words_prompt`, a flag, never the score; a voice under the floor is unchanged (C3, C5, H1) · FE, BE
- 2026-10-21 · a moment the walk went past is answered: its black line goes at once and its paragraph opens the walk as given, no longer its practise again; a skip is told to the server where the machine did not close the practice, and the Take's other moments no longer take the answered ones' place on the next read (F3; until then only helper words picked in the walk settled a moment, since judging one's own moments left the walk) · FE #936, BE #1259
- 2026-10-21 · N112 · a sentence that hedges gets its clearer version from a rule: its softening hedges left out, nothing added, a hedge's words that are not a hedge where they stand kept; it opens with C5's plain line (H3) · BE #1257, BE #1258, FE #935
- 2026-10-21 · N108 · the voice decides: the two strongest voices are shown, the strongest is "your most confident moment", a voice at the floor is praised (the Clearer version when its words need help) and only a voice under it gets the voice Exercise; a voice correction with no exercise and no AI clip is skipped, never Line A on its own, and still reaches the coach; the Take's most confident moment keeps its own line and is said again (N109) (C2, C4, H1) · BE #1242, BE #1243, FE #930
- 2026-10-21 · N111 · I1 drops "half praised and half low" (N86, N101 and N97 set the order); I3's 200 labels are 200 settled clips; the page also guards the next-Take share screen, the coach's link, the reading's wait and the typing dots (§4) · BE, FE
- 2026-10-21 · N110 · the waiting screen stays: the Lounge shows the same screen the moment the Lab hands the Take over, in place of the chat (A1); it stays over the lens until the walk's first step is on screen, in place of closing when the text is stored and the lens opening on its typing dots (A2); the bar shows 1% from the first second, in place of "…" before the first report (A1) · FE #931, BE #1245
- 2026-10-21 · the top moment, when corrected, opens with its own line, named solid and confident and fitting what follows (a clearer version, an example, or saying it again), three phrasings each around the founder's line, in place of "so far"; on its AI clip it stands in for L4; no Line A on that moment (C2, K); the AI clip's wait no longer ends on a failed start or an empty read: the start is asked again three times, an empty read keeps waiting (C6, H2) · FE
- 2026-10-21 · N106 · the page's label line under its title, and the docs it names as clickable links; no rule changes · BE #1239, FE #926
- 2026-10-21 · N102 · §I points to the one page for learning and the label quorum (backend [`docs/LEARNING-AND-QUORUM.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/LEARNING-AND-QUORUM.md)); no rule changes · FE #922, BE #1234
- 2026-10-21 · WIL-93 · the coach's link opens the coach's feedback read or not: seen and answered, the word and the coach's answers as given (it opened and closed at once); with nothing of the coach's on the page, the chat at the coach's bubble, which pulses once (C1) · FE #919
- 2026-10-21 · WIL-93 · a coach's door with nothing of the coach's to show goes back to the chat, where the coach's bubble is, never to the text; the coach's link in another account says "This link is for another account." with "Log in with that account" instead of waiting on "Building your Ideal Text" (C1, K) · FE #917
- 2026-10-21 · WIL-93 · the coach's WhatsApp and email links, tapped signed out, go to log in and back to the coach's feedback; a guest's own project stays on the guest's screens (C1) · FE #911
- 2026-10-21 · N97 · WIL-32 decided: the speaker/coach disagreement signal stands and waits until speakers answer about their own clips again (§3); other speakers stay one per try, other speakers' moments first and licensed clips for the places left, replacing the note's 3 every walk of 2026-10-19 (C8) · FE #915, BE #1219
- 2026-10-21 · the AI voice's bubble in the Lounge is short: its first line, the voice and the › every step bubble has; the why and the closing line stand in the walk it opens (B12) · FE #912
- 2026-10-21 · a door on a Take not yet finished opens the whole walk as it stands, the waiting step live and the answered parts to scroll, every moment under its Take's number: no lone piece, no step posted again at the bottom of the chat (B10) · FE #910
- 2026-10-21 · "Good job" only when no level line is sent (C2, the docs to the app); the sharing question's three lines as the app says them (G1, K); "✓ Practised" the one ✓ line, over Next on a practised step, every other answered step Next alone (B10, K) · FE #907
- 2026-10-21 · the lens against its page, the founder's eight answers: "N of 8 words" in place of "Tap the words" (C3; was "N of 6 words"); helper words without end punctuation in the speaker's bubble (B7); the Clearer version's new words no longer bold (B4); no "Clearer version" title (C5, K) and no "Exercise" title on the video path (C6, K); every try keeps its number and voice, a try the server did not keep included (C7; until then a late or unheard try was followed by another "Practise 1"); the ✕ beside ⋯ on the Ideal Text stays (F6; was "Close the one way out"); the harness's sample marks its highest moment and levels · FE #906

- 2026-10-21 · helper words kept from an earlier Take no longer settle this Take's moment on the page: the confident moment is walked first, before the correction, as the server already served it (C2, F3) · FE #904
- 2026-10-21 · N93 · a clip that fails its check is made once more with a new seed, never a third time, and a try after a clip that was never made is not scored (C6, H2) · BE #1214, FE #902
- 2026-10-21 · N92 · the coach's answer and video reach the speaker's page as they stand: the stored feedback rows re-read the coach's answer on every read, signed afresh; a coach's share asks for a rebake (C1, D5) · BE #1213
- 2026-10-21 · N91 · a door brings its step to the top of the whole Take's walk, with that step's own buttons in the dock; Next moves on to the next part, after the last onto the page; scrolling and ‹ › move through every part (B5, B9, B10) · FE #899
- 2026-10-21 · N90 · a step already answered past opens the walk on that step with the parts before and after it there to scroll (B10); the coach's bubble is written at the bottom the moment the coach shares (D5); a try not heard says so with Practise again and Next (C7, K); an answered helpers step's pill reads "Edit the helper words" (C3, K); the chain's choices confirmed (E1) · FE #898, BE #1211
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
