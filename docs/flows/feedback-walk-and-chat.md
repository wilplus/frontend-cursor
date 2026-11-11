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
  five seconds (N110). The wait over the walk comes from the Take's own
  marker, so it covers also when the Lounge was not following that job (the
  speaker came back to the app, or left the wait for the chat): from the
  Take straight into the walk, the chat never shown in between, and under
  the walk when it closes (founder 2026-11-01, N319 item 10).
- **A3** The loop never waits for a coach (2026-09-16, 2026-09-26). The
  coach's word opens the walk only when it is there.
- **A4** A guest's processed Take lands on "Done" and the account ask,
  never on the walk: "Done", "Your confidence moments and practice are
  ready!", "Create an account" and "Not now" (`ReadySignUpScreen.tsx`, from
  the Ideal Text page and from the Lounge). The account stays before the
  walk; this replaces N30's and N32 item 5's "a guest reads the whole
  Feedback" (founder 2026-10-29, N273 item 5). Between the line and the
  buttons the wall carries one real piece of the result: the clip of the
  Take's most confident moment, the one the walk's praise opens with, as the
  walk draws it (the orange bubble on the right), and under it the walk's
  own line "This was your most confident moment." in the grey bubble. With
  no such moment, or a clip that will not play, the wall shows without them
  (prototype <https://claude.ai/artifact/LyE1Xa7M5D2FWXDxFzPKtT>).

### B · One chat, two views

- **B1** One thread, stored once: the Lounge thread (`lounge_messages`,
  kind `walk_step`). Every step is a message with one author: the speaker,
  the app (line bank), the coach, the rewrite (LLM) or the summary (GPT-4o).
  Nothing is copied. An old step seen again is stored once. The Lounge
  draws a Take's steps as one bubble, the Feedback walk (B3, N192); every
  step is still stored, so Will, the summary and the coach's queue read the
  same rows.
- **B2** Lens on is the walk: the same messages as one chat that grows by
  taps, full screen, 18.5px text, 22px corners, no picture beside a bubble
  (N301), ‹ › and ✕ in the bar, no message box, no scrollbar (wheel, trackpad or finger). On a
  computer the lens is as wide as the Lounge's chat column (max-w-3xl); the
  Ideal Text's Record Take and Close sit in the same column (2026-10-20).
- **B3** **The Lounge** (lens off) is the main view: 15px text, 16px corners,
  no picture beside a bubble (N301). After a Take the chat shows, in this order:
  1. the speaker's recording, with who hears it as one line under its player
     (G1);
  2. **the pair:** the Take's "Feedback walk" bubble and, right under it, the
     Take's Ideal Text card (D4);
  3. the chain after the Take, ending with the goodbye, "Good job. See you
     next time." (D4); under it the bar's middle is "Record Take N" (B14).

  **Before the first Take** the empty Lounge opens with Will's hello, "Hi,
  I'm Will. 👋 Record your first take, and I will help you with your
  presentation." (N270), as a grey bubble, and under it one small grey line,
  "About 2 minutes to record. Your feedback comes about a minute later."
  (founder 2026-10-29, N273 item 2, on the prototype
  <https://claude.ai/artifact/H2CwSoSWXF7wttNEXsPMYb>). The one button,
  "Start your first recording", is the bar's middle (B14, N483 item 2;
  was under the hello). With the plan, its questions come first and the
  hello and the line don't show (the-plan.md B1).

  **The Feedback walk bubble:** light grey, on the left. It reads "Feedback
  walk"; under it one small grey line: "🔒 Take N" at its start for an older
  Take, "Edited" once something in the walk changed (B13), and the Take's
  date at its end, in the recording's format ("Oct 25, 2026"). Its › opens
  the walk (B10).

  **The pair:**
  - Both are as wide as the card: 80% of the chat, at most 384px. The
    Feedback walk has that width from the moment it lands.
  - The card sits 3px under the Feedback walk, their left corners drawn in
    where they meet (no bubble has a tail, J6).
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

  **Record buttons:** no bubble carries a button (N294 item 7). The chat's
  one record button is the bar's middle (B14): "Record Take N" for the
  newest Take, "Start your first recording" before any, the black button
  with the red dot. A practice day's "Record Take N" is the plan's:
  [`the-plan.md`](the-plan.md) G6. Was: "Record Take N" alone in the
  message box's place once the speaker tapped to continue, with a grey ✕
  beside it (N296 state 4, N395); with a plan, "Start your first
  recording" in place of the bar under the plan card (N161, N319 item 2).

  (Founder 2026-10-26, N192: "there should be just the ideal text after the
  take and the feedback walk above it", "make sure that all of these are in
  one bubble now in a bubble with a date and a small arrow to open it", then
  "go with A"; N202: "always as two bubble pair", then "yes, go with both
  recommendations". Drawn and not chosen: the card alone with a black line on
  every paragraph the walk has something on, and one card with a Feedback
  walk row.)
- **B4** Bubbles: the speaker orange on the right; the app and the coach
  light grey on the left. No picture of a sender or a receiver beside any
  bubble, the coach's included (N301): who wrote it shows in its words. No
  bold in any bubble, the Clearer version's new words included (2026-10-21).
  No sender labels, except "Your coach:" which opens the
  coach's bubble, with the colon (2026-10-20).
- **B5** Nothing swaps. Each step reached lands under the one before;
  earlier steps stay above to scroll back to; nothing leaves the thread while
  the lens is open. Each new bubble, and the typing dots before it, land at
  the bottom, right above the buttons, as in the Lounge; the thread follows
  them down until the speaker scrolls up by hand. A thread shorter than the
  screen sits at the bottom too, and the lens screen's own wait while the
  walk loads is the typing dots there, so the first bubble lands where the
  dots were; they show only once the walk is still loading 0.3 s after the
  screen opens, so a quick load never flashes them (N122, N499). What opens a part (the
  walk's answer to the step before, "And here's one moment to try another way:", a
  lead) lands first, then the step's own bubbles one at a time, the AI
  clip's fix's too; moving on, the thread glides down to them (N440; was:
  the opening lines at once, the AI clip's fix in one frame and a jump
  past it) (founder 2026-10-23, N122;
  until then the newest step came to the top, its name at the top of the
  thread and its bubbles under it, 2026-10-20, which had replaced N81's
  "scroll to the bottom"). The step the walk stands on has the buttons;
  opened on a step already answered, the walk stands on that step and the
  whole Take's walk is in the thread around it (2026-10-21, B10).
- **B6** Each step opens with its name as a small line ("Slide 2", "Slide 2
  · helper words", "Take 2", "Your coach"). The bar shows the step in view;
  ‹ › scroll to the step before or after, within this opening of the walk.
  The bar's ‹ › (36 px) and ✕ (28 px) each answer a tap 44 px wide; they
  look the same (N440).
  A slide is named by its title in the speaker's deck ("Traction",
  "Traction · helper words"), as the locked prototype's bar does; a slide
  with no title keeps "Slide N", a talk with no deck "Your talk" (backend
  N397). The clip's own label and the words posted to the Lounge keep
  "Slide N".
  In the One thing walk the helper words (C3) and "Lesson done." (C9) keep
  the fix's step's name, the slide of the moment whose paragraph takes the
  words (their best's with no fix, N374), the Sniper's slide with the
  Sniper (N435 item 7; "Tempo" when its slide is not found); never
  "Other speakers" (the prototype's `carry()`, 2026-11-03). In the One
  thing walk the names are the bar's alone: the thread draws no small
  line, a place with no height that the bar and ‹ › still read (backend
  N435 item 1, `WalkThreadMark` `quiet`).
- **B7** The step's buttons are a dock under the thread. In the One thing
  walk a tap ("Try it", "Keep mine", "Skip") adds no bubble of the
  speaker's to the walk, as the locked prototype draws it (backend N435
  item 2), nor to the chat (N452 item 1; was: the chat kept them as the
  speaker's messages); the choice is still saved (the Clearer version's
  accept or keep, the Sniper's game, the try's words). Elsewhere a
  choice lands as the speaker's orange bubble, in the words the Lounge stores (helper words
  without the sentence's punctuation at either end, "growth doubled" not
  "growth doubled,", 2026-10-21); the next
  step's bubbles land one after another, each grey one behind the typing
  dots, 350 ms a bubble (the Lounge's beat, 2026-10-20), and its buttons once
  they have all landed; the walk's answer to Skip and the helper words
  after it land the same way, before "Lesson done." (N440). Next and
  Continue post nothing.
- **B8** The typing dots are the only wait, in the lens and the Lounge: a
  bubble being written, a try checked, other speakers' moments or the summary
  loading, the thread loading, the processing bubble. No breathing mark.
- **B9** Scrolled away from the step the walk stands on, the buttons read
  Next, which brings that step back, with the step's Skip kept under it
  (founder 2026-11-03, N440: "keep the "skip" below it"); a link that
  leads elsewhere ("Keep mine" records, "Keep these") waits with the step.
  The step, from its first bubble to its last, is away once less than
  48 px of it show and back once 96 px do (all of it, when it is shorter),
  so the dock changing never moves it in or out of view by itself (N440;
  was: never away, as the step was measured by a wrapper with no size);
  the recorder never gives way
  (2026-10-21: "away from", no longer only "back to an answered step"). A
  walk opened as a scroll has neither (B10, N259, N539).
- **B10** **Every door opens the walk the same way** (one mechanism, N89):
  the whole Take's walk, standing on one step brought to the top, the parts
  before and after it there to scroll. That step has its own buttons in the dock;
  Next moves on to the next part, and after the last onto the page; ✕ goes
  back where the walk was opened from (B11). Once the walk is done, it opens
  as a scroll: no buttons and no Next, on any step; the bar's ✕ and ‹ ›
  stay, and clips still play (N259).
  - **Only the first opening goes step by step** (N539): the walk that
    opens by itself when the Take's feedback is ready. Every opening after
    it from the chat (the Feedback walk bubble, a step's bubble) keeps
    what was done as it was, read only, and what is left to do (N542):
    - **What was done** is as given: every answered step, every try as
      made, no Next on any of it.
    - **What is left to do** can still be done: a step never reached, a
      choice not made (the Clearer version's Try it or Keep mine, the tempo
      game, other speakers' moment), a practise stopped before it ended
      (N458: it opens on the try again). The first of them stands at the
      bottom with its own buttons, the rest above to scroll, and the walk
      goes on from there (`walkAsItStands` `waitsAt`).
    - **Nothing left:** the scroll above.
    A changed coach word not yet seen still goes step by step from the
    word, so its Continue marks it seen (D5). The Ideal Text page's own
    doors are unchanged. Was: the walk stood on the step the bubble named,
    each answered step reading Next (until N542: the scroll whatever still
    waited, N539) (`review` in `useDeckFeedbackWalk.tsx`).
  - **A scroll ends on Close at the bottom** (N539), only once nothing is
    left (N542), with the bar's ✕; both end the review as Close under
    "Lesson done." does (C9). While a step is left, its own buttons and
    the ✕. Was: no button at the bottom, only ✕ (`WalkThread.tsx`).
  - **The Feedback walk** opens:
    - on the coach's word, while a changed one is not yet seen (C1, D5);
    - while the walk runs, live on the step it waits on, from the page;
      from the chat after its first opening, on the first thing left to do,
      what was done above it read only (N542);
    - once the walk is done, on its newest step, as "Review feedback" does.
      Everything the speaker went through is there to scroll, read only, down
      to the summary: the tempo step (T) and the other speakers they judged
      (C8) included (N247), with no buttons (N259);
    - never on the Ideal Text in the walk's place: it always names where to
      open (fixed 2026-10-26, after a walk paused on its summary, or with no
      part to stand on, had opened the text).
  - **No "Continue review"** (N532): the review is reached from its
    Feedback walk, which wears the outline while a step waits; the bar
    never holds the next Take back. Closing the walk, by Close or ✕, leaves
    "Record Take N" in the bar (B14). Was: "Continue review" as the bar's
    middle until every step was answered (N483 item 2).
  - **The orange outline:** the Feedback walk of a Take whose walk still
    waits, or whose coach's word changed and is not yet seen, has a full 2px
    orange stroke all the way round, nothing cutting it (J6).
  - **An answered step** is read only. While the walk is not yet done, it
    stands with its own buttons: the helper words still editable on the
    latest Take (F3), any other answered step reading Next. Once it is done
    there are none: a tap on helper words brings theirs ("Edit the helper
    words", "Keep these"), and once chosen they go again; Keep these leaves
    the words as saved (N259).
  - **A door that names no step of the walk** (a coach's word on a moment)
    opens on its moment's step. A finished walk asked for a step it does not
    hold, or for its summary, stands on its newest step.
  - **A Take not yet finished:** the same whole walk as it stands, what is
    answered as given and what waits live, each moment under the number the
    Take's walk gave it, so nothing is posted again as a new bubble. From
    the chat it stands on the first thing left to do (N542); from the page,
    on the step the page names.
  - **An older Take's walk** is read only and ends on that Take's Ideal Text.

  (Founder 2026-10-20, N89: "THE SAME MECHANISM"; 2026-10-21, N91: "the WALK
  opens up immediately on that part of the WALK, but you can scroll to
  previous parts or scroll to the next ones", "on a click you close the walk
  and not go to the next element of it"; 2026-10-21: "the opening of the
  bubbles doesn't open the walk in a scrollable manner"; 2026-10-26, N192:
  "make sure it is well visible and not cut the stroke is there clearly";
  2026-10-29, N259: "on the reopened walk there is only a scroll there should
  be no buttons!", then "Buttons only after a tap";
  2026-10-26: "the feedback walk opens the ideal text instead of the feedback
  walk!"; 2026-10-28, N247: "It should open the whole feedback walk with all
  the things that are there that we went through, the judgment time, the
  sniper, whatever intervention was included in the feedback", then "Both,
  read only".)
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
- **B14** **The bar under the chat** has one logic in every chat
  (founder 2026-11-04, N483, locked on "The Bar, Clickable"
  <https://claude.ai/artifact/WfwtMu9qc6aefz3zYUdPC2>, version 12, N498). The left
  holds your things: in Will's chat the stack, Your projects (N460 item 5).
  The middle holds the one thing to do now, the first of these that holds
  (`Lounge.tsx`; `WillBarMiddle` in `plan/PlanDock.tsx`; `useWordsBox` in
  `WillQuestion.tsx`):
  1. Will asks for your own words ("What was missing?", his follow-up with
     no answers to tap, or "Something else", the first of his answers,
     tapped): the box "Type your answer". Empty, a box opened from
     "Something else" closes when you tap away; one Will asks for stays
     until you send. You type at no other time, and your name is never
     asked here: it comes from sign-up (N498 item 2);
  2. Will needs to hear you (the plan's spoken questions,
     [`the-plan.md`](the-plan.md) B10): "Record your answer", with "Not
     now" a grey word under his question; "Not now" leaves it until the
     chat is opened again;
  3. otherwise "Record Take N" for the newest Take (the goodbye's, a
     practice day's, else the thread's newest Take), faded while a Take is
     processed; "Start your first recording" before any Take. An
     unfinished review holds nothing back: no "Continue review" (N532,
     B10).

  One black button; the red dot means a tap starts a recording. No mic, and
  no ✕ beside the button or the box. While an answer is said, **the one
  recording bar** (N314, locked; N304) takes the bar's place: the trash on
  the left, then the walk's strip (the pulsing dot, the clock, the track)
  with the red Stop inside it. Stop sends, the trash throws it away. The
  same bar for the plan's spoken answers ([`the-plan.md`](the-plan.md) B3),
  the walk's practice (C7) and the tempo step (T); a Take keeps its locked
  recording screen, whose strip is the same (N70, N303). Was: "+", "Type
  here" and the mic always (N369); the mic orange while Will waited (N296,
  N319 item 1); "Type here" faded while the plan asked, with its note (N319
  item 3, N323, N325); "Something else" in the bar's middle (N371 item 3);
  voice notes to Will and the "#" note (N253).
- **B15** **The chat follows the newest bubble after an answer** (founder
  2026-11-01, N319 item 9): after a tap, a typed message, a voice answer,
  the continue tap or an answer to the plan's question, the Lounge lands on
  the newest bubble even when it was scrolled up. Bubbles that arrive on
  their own move it as before.
- **B16** **A question is the last bubble, right above its answers**
  (founder 2026-11-06, backend N537), everywhere in the app: when Will
  asks something with answers to tap (the plan's own yes, the ratings, a
  new project's question, an ask after a Take), nothing he says comes
  between the question and its buttons. After a Take on a plan the order
  is the goodbye, the plan's bar when it shows (D4, N623), then the
  question with its answers under it (D4). Was: the plan's yes
  over the goodbye and the bar, its buttons far below it.
- **B17** **A Take's bubble opens its words** (backend N576, for N331): under
  the player of "Your Recording" in Will's chat, "Read it" opens what was
  said, one paragraph per slide in the slides' order, inside the bubble;
  "Hide" closes it. Closed by default, so the voice is heard first; nothing
  shows before there are words. The words are the Lounge read's
  `metadata.words`, from the speaker's own Take only (backend
  `services/lounge_clips.py` `attach_take_words`); the same `VoiceWords`
  as every chat with a person (`chats/ChatThread.tsx`).

### C · The walk, in order

- **The One thing walk** (founder 2026-10-31, N309; prototype
  <https://claude.ai/artifact/X4gDmGfHH7ivuoRZ9ufiy9>, the walk from
  <https://claude.ai/artifact/S8zzcsVEqcDYVC7XQ25Ntg>, steady tone only).
  In order: "Hi {name}." (C0) · Last time (C0a) · the coach's word when
  there is one (C1) · their best (C2) · one thing to improve (C4, C5 or
  T) · from Take 2, one moment of another speaker (C8) · the helper words,
  on their own (C3) · "Lesson done." and Close (C9). A Take served before
  N289 (no slots) keeps the walk it had (C2's "Was").
- **C0 Hello.** The walk opens once with "Hi {name}."; with no name on the
  account "Hi." (N309 item 1). Was: "Hi {name}, good to see you back!", on
  Take 1 "Hi {name}, great to meet you!" (N120), which a Take served before
  N289 still says.
- **C0a Last time** (N309 item 1; every fix, the pace game too, N347 item
  3). The last Take's fix is one the walk opened on screen, named by what
  it showed (a Clearer version, or the voice Exercise its lost Clearer
  version gave its place to); a fix the speaker never saw is never named
  (backend `take_progress.walk_gave`, the walk's "opened" moment events).
  When last Take's fix rose on this Take (backend
  `take_progress.last_fix`, route `GET
  /v2/explore/arc/<arc>/review/last-fix/<take>`): "Last time: {the tip}.
  You did." under the hello, with this Take's best clip on that slide as
  the speaker's orange bubble. A moment's fix rose when its issue is gone
  on the same slide; the pace game's (the Sniper, when the last walk fixed
  no moment, T) when every clip on that slide this Take spends less of
  its time past the green, on the side the stretch leaned, than the bar
  that picks a stretch (`tempo_stretch.MIN_OUTSIDE`;
  `tempo_stretch.stays_inside`), T's one rule for "the pace fix worked"
  (N350 item 3; was: less than the stretch itself had, any drop,
  `tempo_stretch.furthest`). The tip is the one the last walk gave, kept
  with its fix step in the chat (`fix_tip`): the AI clip's tip, lower-cased
  ("Last time: let “fourteen shades” wait a beat. You did."), the Clearer
  version's "say it straight", or the pace game's "give “{words}” more
  room", kept with the tempo step's opening, {words} the Sniper's helper
  words (C3): "Last time: give “{words}” more room. You did.". Not risen,
  or no tip kept (a stretch past eight words gives no words of its own):
  no line. Drawn when it is there while the walk still stands where it
  opened, told to the chat once. Was: only a moment's fix; the Sniper had
  no tip, so no Last time (2026-11-02).
- **C1 Your coach.** First, if there is one: "Your coach:", the coach's
  bubble (video or words only; everything the coach sent), then "Continue".
  Only this Take's coach word opens it (2026-10-20, narrowing N48.3 Q11 A):
  an earlier Take's word served in its place stays in the Lounge as the
  coach's bubble and opens no Step 0.
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
- **C2 Their best, and one fix** (founder 2026-10-31, N309 item 1). The
  picker still chooses (N289, N293; H1): its strongest is **their best**:
  the clip with its words, then one bubble, "To our ears, this one sounded
  really sure." or "To us, this one sounded really sure." (the same for the
  same moment, `bestLine`; how it sounded to us, never a verdict or a
  ranking, N565 item 7; was "This was your most confident moment.") and
  "Why it worked: {the moment's signed cue line}" (B01–B09 or the cue's
  sentence, lower-cased after the colon), then Next; nothing to practise,
  no level line (W1–W10) and no reason bubble. Then **one thing to
  improve**: "And here's one moment to try another way:" and ONE fix, on ONE moment,
  its tool by the kind of its weakness (N548): this week's level's moment
  on a plan (N289 item 8), else the weakest, the less confident moment,
  whose own clip shows a voice problem the AI clip can teach (N425): its
  Clearer version first when its words need help too and it passes the
  gate (C5), else its AI clip after their best (C4). Only a Take where no
  moment's voice shows a problem gives the fix to the moment whose words
  need help most, with its Clearer version (C5); with none that passes, no
  moment is the fix and the walk can end with their best alone (N381):
  on a good Take, no moment below the floor, "The rest of this Take held up just as well."
  where "And here's one moment to try another way:" would be, before the helper words
  (N551; backend `nothing_to_fix` on their best's row,
  `ONE_THING_COPY.nothingToFix`); then, when the Take's least confident moment reads below the floor, no
  tool we have reaches it and it goes to a coach, blind, as a moment to
  judge; the speaker sees nothing new, and a coach's answer comes back on
  its own screen (N550; backend `moment_pick.unfixed`,
  `judgement_follow_up.follow_up_without_tool`). A
  Clearer version lost on the way gives its place to the same moment's AI
  clip: the server swaps it when its rewrite row is not served
  (`take_feedback_policy_v3_service._name_lost_clearer`, the frame's
  `fix_backup`), and the walk does the same when it cannot draw a served
  one, by the moment's `voice_too` flag (`oneThing` in `walkPlan.ts`);
  without the flag, no moment is the fix and the walk is their best and
  its helper words (N547 item 2). Was, 2026-11-06 to 2026-11-09 (N547):
  the moment whose words needed help most was the fix ahead of the
  weakest, on another moment, and a lost Clearer version gave its place to
  the weakest; the walk still drew the closest exercise when it could not
  draw a served Clearer version, whose AI clip the moment's voice often
  could not make. Before it, 2026-11-06 (N536): the closest exercise, "We
  don't have an exercise for exactly this yet, so here's the closest one."
  and "I've asked your speaking coach to make one just for you.";
  the Sniper (T) and no
  moment on a pace or pause week whose Take has a stretch, and for
  everyone, with or without a plan, at any level, when rushing is the
  Take's biggest issue (T, N323 item 6). A fix the last walk gave that
  worked on this Take (its issue gone on that slide, by the rule Last time
  uses, C0a) is not given again on that slide: the AI clip, the Clearer
  version, the level's moment with that tool and the Sniper pass over that
  slide, and the one fix is chosen from everything else as above (another
  slide, another tool, or none); when the issue came back the same fix may
  be given again; no walk before, or one that cannot be read, and the pick
  is as it always was. Nothing on screen says so (N359). A slide that had
  helper words when the Take was recorded was worked on: their best, the
  fix and every next best count a little less there, so they come from the
  slides with none first, unless a moment on the worked slide clearly stands
  out (clearly their best, or clearly the most serious problem), and a Take
  never shows fewer moments. Their best and the fix spread over the talk:
  the Take is read in three parts, its beginning, middle and ending, by
  where each paragraph stands; the fix counts a little less in their best's
  part, and the part the last walk praised or fixed counts a little less
  for that slot, unless a moment there clearly stands out. On a plan the
  level keeps its slot and its moment prefers an untouched slide and
  another part in the same way. What was trained stays skipped, as above
  (N546; was, 2026-11-06, N543: a worked slide filled a slot only when no
  untouched slide could; before it only a clip whose own words held them
  gave way). Nothing on screen says so. The server serves
  only these two (backend `take_feedback_policy_v3._one_thing`), so the
  Ideal Text's marks, the coach's queue and "did the fix work" hold the
  same two; the next bests and the second fix are not shown. Was (N289,
  2026-10-30 to 2026-10-31, the paragraphs below):
  "three moments, three jobs" (founder, 2026-10-30, N289: "the
  praise clips just get the praise ... the moments that need to be
  improved, get the AI [clip]"; "do it a sandwich way. First, show the
  strongest, then the weakest, and then the average"). The Take showed three
  moments, one per paragraph, several on one slide when that is where they
  are (H1; three since N284; a short Take still shows two, N246):
  the **strongest**, the highest willfidence, always praised whatever its
  voice, with no AI clip and no practise, then its helper words (C3); the
  **weakest**, practised with the AI clip (C4); and the **one between**,
  the moment whose words need help most, with its Clearer version (C5),
  kept only when a rewrite passes the gate. A slot nothing fills, or a
  rewrite that does not pass, is a **next best**, praised like the
  strongest. The order: the strongest, the weakest, any next best, then the
  one between, then the tempo step (T), so the walk ends on the precise fix.
  On a plan, this week's level takes the slot whose tool fits it, never a
  fourth moment (the-plan.md G7, N289 item 8). Was: the three highest,
  praise first and then the corrections, the voice deciding each (N108,
  N284), every praise practised with the AI clip (N122); the server still
  says `confident_practice` on a Take baked before 30 October, and such a
  Take keeps that walk. A
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
  "Next", then its helper words (C3); no practise (N289 item 1). Praise is never
  promised. A served moment with nothing attached is the moment said again,
  so the lens always has a step; with no moment at all the text shows.
  Helper words kept from an earlier Take settle nothing: this Take's moment
  on that paragraph is walked like any other, in its slot (founder
  2026-10-21: the Exercise had opened the walk and the confident moment came
  later; the server already counted only this Take's words, 2026-10-13).
- **C3 The helper words come on their own** (N309 item 3), after the fix
  and the judged moment: "These are your helper words. They'll appear on
  screen during your next take, to remind you of what you learned here.",
  then the words alone, in bold: the words of their own sentence the fix
  leans on (the AI clip's quoted phrase; their own sentence after "Keep
  mine", without the hesitations it opens with, "So, um, I think…" giving
  "I think…", N435 item 5, `withoutOpeningFillers`), or the Clearer
  version's sentence after "Try it", without its punctuation at either end
  as B7 says (N440; was: its full stop kept); the Sniper's
  stretch. They are saved as they land, through the same save the picker
  used (the paragraph's span and its lock; the Clearer version's sentence,
  which is not the paragraph's, to the slide from the practice it was
  opened on, backend `helper_words_from_practice`, `source: "passage"`),
  so they show under the slide in the next Take and on the Ideal Text, and
  the chat says them with the line. One set of helper words per slide,
  the newest wins (N347 item 4, N118): when two moments on one slide both
  give helper words, the later pick is the one the recording screen shows,
  as the words are kept per slide. Their own sentence's words and the
  Clearer version's sentence are saved whole, whatever their length
  (N323 item 2; the paragraph's save sends `source: "walk"`); the cap of
  eight stays for helper words picked by hand on the Ideal Text and for
  the Sniper's stretch, a whole clip (N325 item 5). Found where they are
  saved. When the fix gives none (no fix at all, a tip that quotes no
  phrase, as the AI clip's tips for pace or fillers, or a stretch past
  eight words), their best's own words, whole, are the helper words, with
  the same line, saved on their paragraph the same way (N374; was: none,
  and the walk went from the try to "Lesson done.", N323 item 3); none
  found there either, and the walk goes on to "Lesson done.". No pick.
  The picker below
  stays for editing them from the Ideal Text (F5) and in a Take served
  before N289. Was: **Choose your helper words**, after each praised moment, after the
  Clearer version of a moment whose voice reached the floor (C5; founder
  2026-10-22, N113: "After the rewording"; until then helper words came only
  after a praise, so a Take whose strong voices were all reworded had none),
  and after a correction whose practise ends on a Good job, right after it
  (C7; founder 2026-10-27, N220: "if you improved, you can make it your
  habit words"; until then a correction's Good job went on with none, so a
  Take whose two moments were both under the floor had no helper words); a
  moment gets them once. When both moments sit on one slide, helper words
  picked at the first never hide the second: it stays until it is walked
  (founder 2026-10-28, N246, "Second stays"; until then it left the walk).
  The step:
  a big bubble in the thread with large plain word buttons, no borders,
  chosen words orange;
  "N of 8 words" at the top, the count against the cap (eight since
  2026-10-15; N178), in place of "Tap the words" (2026-10-21); "Use these helper
  words" and "Skip"; once the words are
  given, the pill reads "Edit the helper words" and the link "Keep these"
  (founder, signed 2026-10-21). Helper words stay
  editable in the walk, opened from the Take's Feedback walk or from their
  orange words on the Ideal Text (F5), on the latest Take only (rule 5); an
  older Take's words are locked ("🔒 Take N"). In a walk opened again once
  done, a tap on the words brings their buttons, and they go again once
  chosen (N259). A change is an edit (B13): the
  speaker's words bubble shows the new words in place and reads "Edited", no
  second bubble and no struck-through old words (N192). They come from a
  moment that sounded confident. Opened while the marks may still land, the
  picker waits for them, so it is the Take's step in the walk and not one
  screen on its own; only a paragraph with no moment opens on its own
  words (F5; 2026-10-20).
- **C4 The AI clip after their best** (N309 item 1): the fix moment's
  clip with its words, the phrase the AI clip leans on bold in them and in
  the tip (N445), "Say this one like your confident moment:", their
  best's clip played again (without words), then the AI bubble: the tip ending ", like this:", the AI
  clip with its label (no opener; no "Your turn.": the "Try it" under it
  says it, N379 item 3). The AI clip goes only to a moment whose own clip
  shows a problem it can teach, against the speaker's own usual on this
  Take: faster than their usual pace, fewer pauses, a flatter loudness
  range or more fillers, at the line the clip already uses. It teaches the
  strongest of these, never the runner-up; with none, the AI clip is not
  the fix, and there is no "Lean on …" on a guessed phrase (N425). Was: the
  lowest S × W whatever its voice showed, the clip choosing on its own what
  to teach, stress on the main point when nothing was measured, and the
  runner-up about 15 times in 100. With no AI clip coming,
  the rest stands and the try is still theirs (never walked as good, never
  skipped: it is the one thing), and the fix still says what to do (N370):
  one bubble with the same tip as its own sentence ("Pause before
  “{phrase}”."), when the server named what the clip would fix, the served
  exercise's video and instruction when there is one;
  the chat says the same (also when a clip it posted as coming never
  comes), and "Last time" keeps that tip. With none of these, as before.
  The fix never waits long on its clip (N373): a clip still being made ten
  seconds after the fix is on screen gives way to that bubble, and one
  that comes later joins it as its player alone, under the words, which
  stay; once the first try has begun, a clip not yet seen is never shown
  above it (a walk played again shows what is there). Was: the dots stood
  in the player's place as long as the clip took, up to about two and a
  half minutes, and a clip could land above a try in progress. The words
  land with the walk's bubble motion, once per wording, never swapping in
  place; and "Say this one like your confident moment:" is said only with
  their best's clip after it, in the walk and the chat (N377). Was: the AI
  bubble changed into the words with no motion, and the line could end on
  a colon with nothing after it. One example to copy (N379, N624): when the
  fix has its own (the AI clip, the exercise's video), their best is not
  played again, as they heard it earlier in the walk, and "Say this one
  like your confident moment:" stands right above that example; with
  none, their best's clip follows the line, full, as it is the example.
  Was (N379, N440): their best as a small "Your confident moment" chip
  between the line and the AI clip (N289 item 7), drawn with the
  prototype's 24 bars. The bubbles after their best are a polite
  live region, read aloud as they land; the AI bubble's typing dots and its
  label are not read while no clip is ready. Was: their best full beside
  the AI clip, two examples to copy; the dots read as "AI version of your
  voice" for a clip that might never come; "Your turn." above "Try it".
  Was (2026-10-31 to 2026-11-03): with no clip the tip
  went with it, and the exercise's video was never drawn in this walk. Was (N289 item 2, below): **The weakest**
  (founder, 2026-10-30, N289 item 2). It is never
  called weak. Its bubbles: "Here's one with more in it." (signed, N289 item
  7; the level's line in its place when it carries one), its clip, Line A
  "Say this one like your confident moment.", the strongest moment's clip
  played again under "Your confident moment" (signed, N289 item 7), then
  the AI clip with its one tip (C6), up to three tries (C7). Was: a shown
  moment below the floor was corrected (2026-10-20 to 2026-10-30, N108).
  The one between opens on the Clearer version only
  when both gates pass (H3), else it is praised as a next best (N289 item
  5; until then the voice Exercise, words first, then voice, 2026-10-18,
  N76). On a plan, the level's moment in that slot is practised whatever
  passes (G7). The
  Clearer version is served on its moment (the row names the moment's
  block; until 2026-10-20 it did not, so the walk never drew it, "the
  rewrite doesn't appear at all"). A corrected moment with neither a
  clearer version nor an exercise is said again with the AI clip; when no
  AI clip comes either, it is walked as a good moment, never skipped: its
  helper words (C3), never Line A on its own, and the moment still reaches
  the coach (founder 2026-10-30, N284: "if smth is already good it's ok to
  just lock the helper words", "Treat as good"; until then the walk moved
  past it, N108: "Skip that moment"; before that it was "said again, never
  dropped", N88). Played again with
  no try, it shows the clip alone. The Take's most confident moment is not
  skipped: it opens with its own line and is said again (N109, C2).
- **C5 The Clearer version.** In the One thing walk (N309 item 1): the
  speaker's words with their clip, then "Say it straight:" and the
  sentence in bold; "Try it" with the record dot (the accept, then the
  recorder on the sentence) and "Keep mine" (the decline, then
  "Your words it is." and the recorder on their own sentence; N435 item 4,
  was N268's "Your words it is. Now say them like you mean every one.",
  which a Take served before N289 still says); no Skip before the first
  try. A miss
  brings no AI clip. In a Take served before N289: the speaker's words with the changed words
  crossed out; "Here is a slightly more polished option:" (when the reason is
  undermining words, `rewrite_reason: "undermining"`, B10's "Say what you
  mean. Don't dance around it, just say it straight." and "Try saying it
  like this:" in its place, N85); the new text with the new words in orange;
  "Do you accept and want to practise it?", with no "Clearer version" title
  over them (2026-10-21);
  "Accept and practise" / "Keep my words" (which practises their own
  sentence with "Your words it is. Now say them like you mean every one.",
  in Line A's place there only, N268). At most one rewrite per corrected moment. An accepted version
  never changes the Ideal Text (rule 5): it gets there when it is said in the
  next Take. After a try only the voice is checked, on the same lanes as the
  Exercise: better is the Good job and no clip; not yet brings the AI clip of
  the accepted words (or their own after "Keep my words") in C6's short
  bubble, closed by "Try again." (N120; until then L4, L3, then L5). A try with no sound read is a Good job. An answered Clearer version
  stays read only, in the walk and from the Lounge. When the moment's voice
  reached the floor, its helper words (C3) follow the Clearer version and
  its practise, after a Skip too (N113). After a Good job on a Clearer
  version's try, Will may add one bubble under the praise line that quotes
  the speaker's own kept words: a strength, their vision or a # note naming
  what is theirs, at most one per Take, ring 5 only, never shown to a coach
  ([`principles.md`](principles.md) §1 R, N268).
- **C6 The voice Exercise** opens with one short bubble (founder
  2026-10-23, N120): a one-word opener ("Nice." / "Close." / "Good."), one
  tip for the problem the clip fixes, ending ", like this:" (K), the AI
  version of their voice, then "Your turn." (not in the One thing walk's
  fix, where the "Try it" under it says it: N379 item 3, C4); until then L4 "That was good.
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
- **C7 Practise.** The One thing walk's fix (N309 item 1): the recorder
  is the one recording bar in the dock as below; two tries. A try that
  lands: "Yes. That's it." and Next; one miss: "Close. Once more." with
  "Try it" and Skip; two: "Good try. Take it with you." and Next. Skip on
  the fix (in the dock, and the Sniper's) is the walk's "Okay, we'll skip
  this one.", and the walk goes on; the chat writes the same answer, with
  no "Skip" of the speaker's above it (N405, N452 item 1; was: nothing
  said, then the speaker's "Skip" in the chat). While a try records the dock
  is the recording bar alone, no Skip under it: its trash is the Skip,
  the try thrown away (nothing uploaded or counted) and the walk on with
  the same answer, in the fix and the Sniper (backend N435 item 3, N448;
  was, for a few hours on 2026-11-03, the trash back to the step that opened
  it, which every other walk keeps, below). A try that could not be checked
  (late, or not heard, which says so as below) keeps "Try it" and Skip
  while a try is left, Skip with the same answer (N440; was: the outlined
  "Practise again" with no Skip). With practice off there is nothing to
  try: the fix has Next alone, which posts nothing and says nothing about
  skipping (N440; was: "Skip" and "Okay, we'll skip this one."). While it
  records, nothing is added to the thread:
  the recording bar in the dock is the only sign. After Stop the try is the
  speaker's orange clip with the words they were asked to say: the Clearer
  version's sentence after "Try it", their own sentence after "Keep mine",
  the moment's own words after the AI clip (`oneThingTryWords`,
  `walkThread.ts`); the chat writes the same words. Each try keeps its own
  voice and number (its player is named "Practise N" for screen readers).
  The Sniper's try is the tempo step's "Try N" with the dot's path (T step
  6). As the locked prototype X4gDmGfHH7ivuoRZ9ufiy9 draws it (`walk.html`,
  `record()`). Was: every try labelled "Practise N" in place of its words,
  and an orange "● Practise N" pill in the thread while recording. In a Take served before N289: every practise is one thread: the words to say, the
  recorder in the dock (the one recording bar, N314: the trash on the left,
  then the strip with the dot, the clock, the bar and the red "Stop" inside
  it; nothing under it: the trash is the way out (founder 2026-11-03, "for
  that we have the trash button on the left"); was "Skip" under it, the
  walk's grey link, and before that "Skip" in the Back style beside a red
  "Stop" in the Finish-take style), the
  try as the orange "Practise N", the typing dots while it is checked, then
  the answer. Each try keeps its own number and its own voice on screen, a
  try the server did not keep (late, not sent, not heard) included: the
  next is numbered after it (2026-10-21). The recorder's strip is the recording screen's as re-locked 2026-10-12
  (N70), without the slide card; after Stop the walk returns instantly.
  Stop shows once the mic is live: while the mic opens, the bar shows the
  trash and the strip without Stop, as the tempo step's does (T; N350 item
  5; was: Stop from the moment the practise opened, `useWalkPractise`
  `capturing`).
  The trash throws the try away: nothing is uploaded or checked, no try is
  counted, and the walk is back on the step that opened it ("Try it",
  "Practise", "Practise again"), as ✕ does (N314); in the One thing walk's
  fix and the Sniper the trash is the Skip instead, and moves the walk on
  (above; backend N435 item 3, N448). The
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
  a finished walk shows the thread alone, with no buttons (N259): nothing is
  recorded there.
  Nothing else interrupts the practice.
- **C7a Between the moments** (not in the One thing walk, which has one
  moment to fix; a Take served before N289 keeps them) (founder 2026-10-30, N285: "okay, thank you
  for that, let's look at your next key moment we spotted"; "if it's the end
  of the moments it should say …"): each moment after the first opens with
  one grey bubble, "Okay, thank you for that, let's look at your next key
  moment we spotted.", and the first step after the last moment (the tempo
  step, other speakers or the summary) with "These were some real good
  moments of yours, thanks for that practice – we are really moving
  forward."; the summary stays where it is (D). Each is told to the chat
  once (B1, step `lead`), and drawn again in a walk opened again; never in
  the coach's own walk (`momentLead` in `walkPlan.ts`, the words in `walkLines.ts`).
- **C8 Other speakers: one moment, from Take 2** (N309 item 2, N300),
  right after the speaker's try: "Let's see how you find this voice. It
  helps us understand you and serve you better.", then the clip and "Does
  this sound confident to you?" in one bubble (Line B goes), the faces (👍
  Yes, 😐 In-between, 👎 No, large and full width; "Audio unclear" a small
  link), their answer as their own reply "{face} {answer} ✓", then "Got
  it.", and on. The moment's machine level turns across Takes: Take 2
  high, 3 middle, 4 low, then round again (`othersLevelFor`; the queue's
  `?level=`, backend `lend_your_ear.other_voices`, the Take's clip of that
  level, else the next level round), never shown. Take 1 judges no one.
  Each answer is kept as a peer rating as before (L3). Opened again, the
  moment with the answer given, as below. Was (N119, below): once, after the practice: three moments, one the
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
  (G3 as it was; with sending on, no new Take joins the crowd's judging,
  and the step runs on the training corpus and on Takes shared before,
  N479 item 2). **Opened again** once the walk is done, it shows the moments the
  speaker judged, each with their answer, and no buttons (N259). Nothing is asked or sent
  again; with none judged the step is left out (N247; was "no read-only
  replay", 2026-10-13). No other speaker's recording is ever stored in a
  speaker's thread: the moments are read again from the server.
- **C9 The end** (N309 item 4): "Lesson done." and a Close pill, which
  writes the review's end (the Take's card under its Feedback walk, its
  outline goes) and goes back to the chat. No "Record Take N" in
  the walk and no summary inside it: the summary is still written once per
  Take as the walk ends, so the chain after the review runs as before (D4).
  Played again, "Lesson done." alone. Was: the closing summary (D), then
  "Next", which opened the Ideal Text (a Take served before N289 still
  does); no Next in a walk opened again once done (N259).
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
  the chain (D4) ends the chat after the Take, and nothing pushes the next
  Take (N294 item 6).
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
  3. only then the goodbye, "Good job. See you next time." (backend
     `services/after_take.py`), held back while the chain runs. No push to
     the next Take (founder 2026-10-31, N294 item 6). On a plan the goodbye
     is the same, naming no day (N564 item 7), then Will's grey bubble with
     the plan's bar, the level's name and its four marks (the-plan.md E3,
     G13), only on a day the hello did not already show it (N623). Was:
     the bar after every walk (N564); before that "That's your 15 minutes
     for today.", "Good job. See you tomorrow." or "See you {weekday}."
     (N347 item 2) and the bar with "{n} of {total} practices done." (N319
     item 7). A question the plan asks there (its own yes, the ratings, a
     new project's) comes last, under the goodbye and the bar when it
     shows, right above its answers (B16, N537). While Will's question or its
     follow-up waits, nothing of this comes under it, whoever asks: the
     goodbye, the plan's lines and the bar wait until it is answered or
     skipped (N545; was guarded on the Lounge's call only, and the goodbye
     could come under the key line). Under them the bar's middle is "Record
     Take N" (B14), which opens the text as its own button does (the
     sharing question first from Take 2, G); after the first Take it
     records the real talk (N449 item 1). The speaker may simply close the
     app; the stack still opens the projects, and the Take's card still
     opens its Ideal Text with its own "Record Take N". Was: the tap "I
     want to continue my practice" first, then "Record Take N" alone with a
     grey ✕ (N294 item 6, N296 state 4, N395; N483 item 7).
     A practice day's one thing, newer than the goodbye, holds the chat's
     one record button: [`the-plan.md`](the-plan.md) G6.

  **Between two Takes** (N244, N251). From the moment the next Take is
  recorded, in any project, the bar's "Record Take N" is the new Take's:
  faded while it is processed, then live at once, whether its walk is done
  or not (B14, N532). So the chat has one record button, the newest Take's;
  another project is reached through the stack. The stack is held while a
  Take is processed, and the Ideal Text page's own "Record Take N" is
  unchanged
  (founder 2026-10-28: "disable the new event while the processing is
  happening, so that it is only possible once it's finished"; then "One
  record button in the chat, the newest Take's; other projects through the
  '+'").

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
  was at most two, N94). The order: Will's question (which his next one
  may follow, E2), "Did this help?" when the Take looks off. The CEO
  panel's asks are not among them since N391: they come in the bar at the
  top. One question or ask is on screen at a time
  (N294 item 4). While Will's question waits, his answers sit under it,
  "Something else" first, and the bar's middle stays the record button: his
  question never stands in front of the next Take (B14, N483 item 2).

  **Notifications come in a bar at the top of the chat, never in the
  buttons under it** (founder 2026-11-03, N391; prototype
  <https://claude.ai/artifact/9gpMMFvLKFMysRE4Db8mMv>; `NoticeBar.tsx`).
  Once a visit (the Lounge loading, the tab's session) the app asks the
  backend (POST lounge/visit), which makes the WhatsApp ask when it is due
  and answers with the one ask for the bar (backend `person_asks`). One at
  a time, under the top bar, ✕ for Not now. It holds: the WhatsApp ask of
  the next visit (N294 item 8, N295: never after a Take, never before the
  second Take is done, one per Take, at most twice, "It seems you enjoy
  using WillpowerLab." over "Want a WhatsApp when your coach replies? Add
  your number."; done once shown); and the CEO panel's asks to one person,
  which no longer wait for the end of a Take: WhatsApp, a consent question
  ("One question about how we use your data is still open. You can look
  at it and answer yes or no."), the promo price with See prices and the
  lesson price with See times, both the web only: the iPhone app shows no
  price and no way to buy (N365 item 1, N495, N555). Tapping WhatsApp or consent opens its form as a sheet
  from the top (the WhatsApp form; the consent card with No | Yes); the
  price bars go to their page. Not now on a CEO panel's ask brings it back
  on the next visit. **The home-screen ask is deleted** (N391): the next
  visit's, the CEO panel's and Will's offer in the chat. Not in the bar:
  the policy update (its own screen; it blocks recording), iPhone's own
  notification question (N385), and the WhatsApp form Will opens when the
  speaker asks for it in the chat. An old thread's install, consent, promo
  or lesson bubble is plain text. Consent is not a settings ask after a
  Take and the plan's own consent step stays in the plan's questions. Was
  (N294 item 8, N295): WhatsApp and the home screen written in the chat at
  the next visit, their form opening by itself in the footer; the CEO
  panel's asks the Take's one ask from Take 2, in the footer.

  Will opens "Did this help?" with a lead-in: one or two sentences tied to
  this Take (never a grade, never advice), then the ask's signed words with
  a light touch, checked as E2's variation is (no number, the ask still
  said); Will's own question needs none, and the bar's asks are drawn
  as written. "Yes" to "Did this help?" brings "We're glad it
  helped you.", then the next ask. A typed message passes the ask in front;
  an ask that no longer applies when its turn comes is skipped, and so is
  a settings ask or a CEO panel's ask that a message held from before N294
  or N391 still names. These choices (the condition and place of "Did this help?",
  which asks get a lead-in) were confirmed by the founder on 2026-10-21. A distressed answer under "What would help?" gets the chat's
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
  talk is for ("Who were you talking to? 🎯", N347 item 1; was "Quick one:
  who's this talk really for? 🎯"); what they should do or feel; with both known and the talk's
  key line missing, the key line (N294 item 2); from Take 3, with all three
  known, one deeper question in their own words. Each once per talk. Will's question
  is never in the lens. It is about the moment the walk just worked on
  (N294 item 1): it opens on the speaker's own words of the last moment the
  walk showed (its clip's words), "When you said “…”, " where the question
  reads on from it ("…, sounds like this one's for {the board}. Right?
  🎯"), else "We just worked on “…”. " before it; "On purpose?" already
  quotes its own line and opens on nothing more; with no moment, the
  question as signed. One at a time (N294 item 4): who the talk is for,
  answered, is followed by what they should do when that is missing too,
  and what they should do, answered, by the key line when it is missing too
  (no moment quoted again; at most two a Take); not answering, or a Skip,
  ends them. **The key line** (N294 item 2) is the plan's signed question,
  "If {who} remembers one sentence from you, what is it? Say it the way
  you'll say it." with who the talk is for in it ("your audience" when it
  is not known, or the talk is for themself; after a just-answered who,
  the answer, from their side), opened on the
  moment as the others ("We just worked on “…”. "), said as signed, with no
  tap answers: it is answered by voice (E3, N544). Will says
  back who the talk is for, "{who}. I'll keep them in mind." (N294 item 5),
  from the speaker's side: "my team" comes back as "Your team. I'll keep
  them in mind.", and a talk to themself ("Myself", "me", "just me") as
  "I'll keep you in mind." (N406 item 3; was the words as typed, "Myself.
  I'll keep them in mind."). For a talk to themself, what they should do
  is "When you finish, what do you want to do? Or feel? 🤔", with no taps
  (N406 item 4). The goodbye (D4) waits under Will's question until it is
  answered, however it is answered: nothing lets it go past an open
  question (N406 item 1; was: after a typed answer the goodbye came under
  his next question and cut it off).
  Every other answer keeps "Got it, thanks 🙏". Will may say the signed questions with light
  variation, the same meaning in slightly different words; the tap answers
  and the no-numbers rule stay (founder, 2026-10-20); when the variation
  fails a check he says them as signed.
- **E3** The tap answers come from what Will knows, the recording first
  (N297 item 2): this Take's own words, then what the speaker said for an
  earlier talk, then the signed answers for their field, for who the talk
  is for and what they should do alike; orange on the right. Who the talk
  is for has no "Someone else": their own words go into "Something else",
  the first of his answers, which opens the box (N483 item 2; was in the
  bar's middle, N371), so Will asks once (N406 item 2; was "Someone else"
  last, opening "Who is it for, then? 👀", N319 item 8). The check
  ("Right?") keeps "Someone else" and its follow-up. No Skip under Will's
  questions (N296 item 2): not answering is allowed, and the stack still
  opens the projects; their own words in the box answer too. The key line
  is said, not typed (N544): while it waits the bar's middle is "Record
  your answer" and "Not now" is the grey word under it; the tap records in
  the plan's small recording bar (N314: the time, the bin, "Stop") in the
  bar's place, never the recording screens or slides; Stop sends it to
  `/will-question/voice`, heard under the processing authorization and
  answered as typed words, kept as the talk's key line, shown as the
  speaker's bubble with the words Will heard (N275); the recording is not
  kept; "Not now" gives the middle back to "Record Take N" until the chat
  is opened again (`useKeyLineHear` in `WillVoiceAnswer.tsx`, `Lounge.tsx`).
  Every other question of Will's makes no spoken answer (N483 item 7); one
  already given stays as the speaker's bubble. Was: while Will waited the
  mic was orange (N294 items 2 and 3, N319 item 1); then, from N483 until
  N544, the key line offered only the box "Type your answer". One
  follow-up at most, with no tap answers (N294 item 3). A Take that names its audience twice is checked instead
  ("Sounds like this one's for {the board}. Right? 🎯"; the guess becomes
  the audience only on Yes). How Will knows: one gpt-4o-mini call per Take
  (`will_question.heard`, drift-locked, golden rows
  `tests/evals/golden/will_question.jsonl`) under the Take's processing
  authorization; it may return only words the title or transcript says, at
  most four, no number, else Will asks openly.
- **E4** Every answer is kept for Will (speaker memory, kind "answer"); who
  the talk is for fills the Take's setup `audience`, what they should do its
  `strategic_context` ("Desired call to action:"). The next Take's setup
  carries them. The key line (N294 item 2) fills the Take's setup
  `key_line` and an open plan that has none (`facts.key_line`); the Take's
  context reads it as sure, on that Take and the talk's later Takes (H1,
  N293).
- **E5** The founder edits Will's questions on the coach panel, under the
  blind lists ("Will · only you" → "Will's questions"; N83; backend
  [`FOUNDER-LOCK-coach-panel-redesign-2026-10-06.md`](https://github.com/wilplus/backend-cursor/blob/51c67077c3bb09d5a22211f55d9d122919b9983f/docs/FOUNDER-LOCK-coach-panel-redesign-2026-10-06.md)). A question with no
  saved row keeps the signed words in code.

### F · The Ideal Text page, in the loop

- **F1** It opens from its card, or after the summary. It is not the landing
  screen. The card opens the page on the text, from the top; the Take's
  Feedback walk opens its walk (B10). Only the project's newest card opens
  the page; an older Take's card (1.0 when the project is at 3.0) opens the
  words that Take made, as they were, read only: the project's name, "AI-generated
  text · Take N", "This is what you said in Take N." with "Go to Take M"
  (the page), the paragraphs slide by slide with the helper words of that
  time orange, ✕ and "Close"; a version with no saved words opens the page
  with "Take N's words weren't saved. This is Take M." at its top (founder
  2026-11-03, backend N375, N376, N380: "it opens the text that was recorded
  for that time"; was: every card opened the page).
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

### G · Who hears this Take, before the next recording

Built behind the backend's switch for sending (`TAKE_SEND_ENABLED`, off
until the Privacy text for it is signed, N479 item 1). While the switch is
off, or when its reads fail, today's G1 to G4 hold exactly, as written
under "Was:" below (R3, R6). On (founder 2026-11-04, N470 (#1702), N479
(#1704); the prototype "Specialist Side"
<https://claude.ai/artifact/CXHqV7paTVT4iVSA5uiyrV> tab 1, locked):

- **G0** **A Take goes to nobody unless the speaker sends it** (founder
  2026-11-10, backend N626: "I don't want to send it to others now";
  "Nothing by default"). "Record Take N" records at once, with nothing
  sent or shared: the screen below is never asked before a Take and no
  earlier choice is reused (Never 3 stands). Each new Take's line under
  its recording reads "Only me" and, on the latest Take, opens the screen
  for that Take with nobody ticked; Continue sends it to the people
  ticked (G3, G4). Nobody in the list: no line. Sends chosen before this
  rule and still waiting on the phone keep going. This replaces G1's
  remembered choice and its asking again (N479 item 5), below, which
  stay as history (`useRecordAlone` in `IdealTextActions.tsx`).
- **G1** Asked once, the first time "Record Take 2" is tapped, never before
  Take 1, on the walk's own screen (`NextTakeShareScreen`): the top bar
  names the Take; three grey bubbles, "Your knowledge is worth sharing, and
  so are your questions.", "The people below are the ones you trust.",
  "Choose who can answer you best, or send it to all of them and practise
  speaking."; then "Select all" and one row per person in your list of
  chats (the letter circle, the name, who they are), the tick box on the
  left, the person sent to last on top with "Last sent" under the name,
  then the list's order; Continue. Opened for a Take (from its line), the
  person in your chats who can best answer this Take comes first, by the
  matcher's fit (`GET /v2/takes/<take>/match/chats`, `{order: [chat id…]}`,
  never a score), then everyone else in the order above; "Last sent" stays
  under its name wherever it lands and everyone stays ticked. The order is
  waited for 1.5 s at most; failed, slow or off (the `take_match` ring), the
  order above holds (N559 item 2, App Model MATCH-07). Before a Take there
  is no Take to fit, so the order above holds (N589 item 1). The list is real people only: no demo
  or guest accounts, nobody blocked either way; a speaker with no chat with
  a person has one with Artur, speaking coach (N470 item 3, N479 item 7).
  ✕ records nothing. The choice is remembered: every later "Record Take N"
  records at once with it (replaced by G0, N626: nothing is remembered). Asked again only when someone joined your list
  since a choice of chosen people (once; "Everyone in my list" takes them
  in silently), or when nobody of the choice is left (N479 item 5; never
  before every Take, Never 3). "Record Take N" waits for the people and the
  last choice 1.5 s at most, then asks (R1); with nobody in the list it
  records with nothing sent (R3).
- **G2** Ticked by default: everyone (Select all), or the last choice
  (`GET /v2/user/takes/send/last`); from a Take's "Only me" line, nobody
  (G0, N626). Unticking all leaves Continue waiting;
  it is the only time it waits. There is no "Everyone on WillpowerLab" and
  no "Only me" (N470 item 2, N479 item 1).
- **G3** Each ticked person gets the Take as your own message in your chat
  with them, by name, not blind, with the Take attached, already open: its
  recording and its words slide by slide, never its Ideal Text, feedback,
  moments or levels (N470 item 4, N479 item 8, N504 item 1; was "Open Take");
  newest, it asks for an answer, recorded over its own slides (N493 items 1
  and 3; customer-requests.md C1). The Take is sent after its upload, never waited
  on, and never for an answer (R2, R5; `applyNextTakeShare` sends it,
  `POST /v2/user/takes/<take>/send`), and kept on the phone until it has
  gone: a failed send is tried again 5 s and 30 s later, then at the next
  open, signed in, once the thread has painted, within the choice's six
  hours; the next Take's choice never replaces it, and the server posts one
  message per Take and chat, so a retry never posts twice (N541 item 2;
  `retryTakeSends`, `willab.pendingTakeSends`). The crowd stops for new Takes: no
  new Take is shared with other speakers to judge; C8 keeps running on the
  training corpus and on Takes shared before, which stay shared until the
  speaker stops them (N479 item 2).
- **G4** The line under the Take's recording names who it went to
  ("Artur", "Artur, Maya Lindqvist", or "Everyone in my list"), stored as
  the speaker's share line (`metadata.share`: `{kind: "people", all,
  user_ids, names}`), which is the remembered choice. On the speaker's
  latest Take the line opens the same screen with the people it went to
  ticked and fixed: people can be added, and Continue sends it to them; it
  is never unsent (N470 item 5, N479 item 3). A send from the line that
  fails keeps the screen open, ticked as chosen, with "Couldn't share this
  take. Try again.", and Continue tries again (N541 item 1). A line of a
  Take shared with communities before opens today's screen, as it was.

Was (until N470 and N479, and still while the switch is off): "Sharing,
before the next recording":

  - **G1** Asked once, the first time "Record Take 2" is tapped, never before
    Take 1, on the app's own screen: "Before we start the new take!", "After
    all, it's about speaking publicly!" (regular weight) and "How big you want
    your audience?" (founder 2026-10-21: the app's words, "Do you agree to
    share your next take with others?" is history). The choice applies to the
    Take about to be recorded and is remembered: every later "Record Take N"
    starts the recording at once with it, applied to the new Take as Continue
    applies it (stamped with the words version, G4). Asked again only when
    the screen's words change (a new words version) or a community is added
    (a private community joined after the choice); a choice none of whose
    communities is left open asks too (founder 2026-10-31, N309 item 5; until
    then asked before every Take from Take 2, the choice kept six hours for
    that Take alone). The remembered choice is the newest line under a Take's
    recording, which carries what it says and the words version
    (`metadata.share`, "Only me" included); the server reads it back
    (`GET /v2/user/takes/share/last`). A line stored before N309 item 5
    carries none, so the first "Record Take N" after it asks once more. In
    the Lounge the question leaves no bubbles: the choice, in its own words
    ("Only my community (Invita)", "General community", "Only me"), is one
    small line under that Take's recording, also when the Take kept it
    without asking, and "Record Take N" posts no bubble of its own (founder
    2026-10-26, N192, question 3; until then "Record Take N", the question as
    one bubble and the choice as the speaker's bubble, #847). On the
    speaker's latest Take the line, drawn the same, opens the same screen to
    change the choice for that Take and the ones after it: Continue shares
    that Take as now chosen or takes it back from every community (G4), and
    its line says the new choice; ✕ changes nothing (N309 item 5). Open
    (N309): whether the consent words must say the choice covers later Takes
    (a lawyer's check; Never 4).
  - **G2** The options: **General community.** **Only my community**, with the
    speaker's saved communities inside (a passcode entered once; one is ticked;
    several are all ticked and any can be unticked; "+ Add a community with a
    passcode" at the bottom). **Only me**, which stands alone. Nothing is
    ticked when the screen asks, and Continue waits for a choice, "Only me"
    counting (founder 2026-10-15, Privacy 3.6 §4d); opened from the line, the
    choice as it stands is ticked (N309 item 5).
  - **G3** Who you judge follows who you share with, the choice each Take
    carries (asked, remembered or changed from its line): only my community →
    that community first, the general community fills in; general community →
    the general community, and its members may hear your Take; only me →
    nobody but the coach hears you, and you still judge general-community
    moments.
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
    W = mean of: few fillers · few hedges · fits the slide (fillers
        and hedges counted apart, as the clip read counts them and the
        signed legal note describes, document 02 v1.3, N208; "holds
        together" only in the hidden read of a moment, H4; N347 item 6)
  shown     = three, at most one per ~75-word block, several on one
              slide allowed (N289, 2026-10-30; three since N284):
    strongest = the highest willfidence; clips with enough words rank
              before short ones; a sentence that already has its slide's
              helper words (as when the Take was recorded) comes last
              (N246); praised whatever its voice, no AI clip
    between   = from another block, the clip whose words need help most
              (H3; lowest W, then lowest S × W), picked before the
              weakest; the Clearer version when a rewrite passes the gate,
              else a next best; never the AI clip, which is the
              weakest's alone (N381)
    weakest   = from a block left, the clip whose own voice shows the
              strongest problem the AI clip can teach (pace, pauses,
              loudness range, fillers vs the speaker's own usual on this
              Take, at AI_VOICE_MIN_SEVERITY; a relevant sentence counts
              a little more, ties to the lower S × W), with 8 words or
              more and a sound read, never one holding its helper words;
              none such, no weakest (N425; was: the lowest S × W); Line
              A, the strongest's clip again, the AI clip teaching that
              problem
    next      = a slot nothing filled: the next best block, praised
              fewer than three only with fewer blocks, never fewer than
              two with two
  clip      = in each shown block, its highest willfidence clip that can
              be served, a frozen choice kept (N122)
  blocks    = when the two best share a block, the boundary between them
              moves so each has its own (40 … 120 words, never across a
              slide, never cutting a clip); a one-block Take is split the
              same way when each clip has 5 words or more (N118); when no
              cut keeps 40 words a side and nothing else could be shown,
              the block is split evenly between the two (N246)
  order     = strongest, weakest, next, between, then the tempo step (C2)
  helpers   = offered on a shown moment whose S ≥ FLOOR, also after its
              Clearer version (N113)
  highest   = the strongest; its bubble opens with the signed line (C2)
  try       = Δ voice score (S) vs the original ≥ MARGIN (+0.05) → better
  plan      = on a plan (the-plan.md G7, N289 item 8): the clip where
              this week's level shows most (services/plan_walk.py) takes
              the slot whose tool fits it: "Say it once" the between, "A
              voice that moves" the weakest, never the strongest's block;
              the pace levels' line opens the tempo step instead; nothing
              shows it → as off a plan; the level is the one the plan had
              when the Take was recorded
  context   = each Take's who / what it answers / success (N293,
              services/take_context.py), each sure, guess or missing:
              Will's answers in the talk's setup first, then the plan's
              answers, then Will's "heard" read of the Take (a guess); a
              clip carrying the key line or the call to action is relevant
              (1 when sure, 0.5 when a guess): its willfidence counts
              ×(1 + 0.25 × relevance) for the strongest and ×(1 − 0.25 ×
              relevance) for the fix slots; nothing known → as before
  notes     = for a speaker the ring row walk_inner_context reaches (N326;
              ring 6, the founder first): one verbal read per Take
              (services/verbal_read.py), an AI call inside the Take's
              processing authorization, reads what was said against the
              Take's set-up (who, what it answers, success, the key line,
              the set-up's note) and what the speaker noted themselves
              (services/inner_context.py: principles with the Life Panel's
              yes, kept strengths, life goals, Your why, # notes of the
              last 60 days with the notebook's yes, each only where its own
              ring row and consent reach; never Will's private note;
              variables and constants are kept nowhere, so not read) for
              the eight kinds of N290 item 4; a weighed moment ranks as
              needing more help for the between, kept
              only when its Clearer version passes the gate (H3), else the
              pick as without it; never the strongest or the weakest; the
              run waits for it at most 5 seconds, only for a speaker it
              reaches, after the Take is flipped ready and before the
              walk's marks are baked: "ready" and the Ideal Text never
              wait, the walk may open up to 5 seconds later (N350 item 2;
              was: "ready" waited for it); while the run waits, the
              walk's read answers "pending" until the bake starts
              (ideal_text_feedback_bake.hold_for_bake, a 15-second
              "queued" mark set only when the run waits), so the walk is
              never built beside the bake without the read; late or
              failed → as without it; a frozen Take keeps the walk it
              froze
  worked    = the fixes the walk of the Take before gave (the completed
              spoken Take before this one in the talk;
              take_progress.last_walk) whose issue is gone on this Take's
              same slide, by the rule the Takes table and Last time use
              (take_progress.worked → outcome: the voice at the floor, no
              words that need help, the pace game's slide inside the green,
              T): the weakest passes over that slide's clips for the AI
              clip, the between for the Clearer version, the plan's level
              for its tool, and the Sniper is not the fix when its stretch
              is there, nor offered by the tempo route
              (take_progress.pace_worked); each slot fills from everything
              else as above; came
              back → may be given again; no walk before or any failure →
              as without it; read from what is stored, so a frozen Take
              read again keeps its walk; nothing in the frame, on screen or
              for a coach (N359)
  ```

  The unit is the sentence. FLOOR is 0.6 at launch, then calibrated so
  about 7 in 10 blind judges say 👍 to praised sentences. Only the praise is
  sent as "green"; the practise target goes out with no label; the level goes
  out as `level_key` ("W1".."W10"), never the number. A clip with no sound
  read is given the middle of the sound scale and the words order the clips;
  processing logs why nothing was stamped (2026-10-17). H4 works one clip
  through, step by step, with three examples.

  The notes (N326) also shape the Clearer version: the moments it weighs
  most that the model already rewrites (an unconfident read, profanity or a
  low slide fit) are written again with the read's one line on what
  matters to the speaker, in the read's own words; a rewrite that repeats
  a run of words from the notes that the speaker did not say in the Take
  is refused (`rewrite_gate.leaks`), and H3 then applies unchanged. The
  numbers behind the notes live in the code and are calibrated there, not
  here: the weights (`services/verbal_read.py`), how much a weight counts
  (`services/moment_pick.py`), how many moments are written again
  (`services/moment_suggestions.py`) and how long a run is
  (`services/rewrite_gate.py`). Nothing of it is shown: no line says a
  note was used (N326 item 1), no score (Never 1); the frame, the coach's
  queue and the suggestion rows carry only the choice of moments and the
  speaker's own words, never the notes, that they were used, a kind, a
  weight or a reason built from them (Never 2).
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
- **H4** How one clip gets its willfidence, as built (WIL-102;
  `services/moment_pick.py` `read`, with `services/willfidence.py`,
  `services/voice_confidence.py` and `services/slide_alignment.py`). A clip
  is one piece the Take was cut into, about a sentence, with its own
  transcript and its own sound measurements. Every clip is read the same
  way, in four steps. No step is ever shown to the speaker (Never 1, AC-9).

  ```
  1  S  the voice     7 cues against the speaker's usual → −1 … +1 → 0 … 1
  2  W  the words     the mean of: fillers · hedges · slide fit      0 … 1
  3  willfidence      S × W                                          0 … 1
  4  it is used for   the pick (H1) · the praise's level · the coach's
                      line (N104) · the founder's Takes table (N105)
  ```

  **Step 1 · S, the voice** (`voice-confidence-universal-v3`, stamped on
  the clip when the Take is processed; the same for every speaker).
  - Seven cues are measured on the clip: pitch range, loudness range,
    pausing, mean pitch, speech rate, whether the pitch falls at the end,
    and whether the loudness starts strong and eases off.
  - Each cue is set against the speaker's own usual: how many of their
    usual spreads (standard deviations) it sits above or below their usual
    average (a z-score). Their usual is the clips of their recent Takes (up
    to 5, at least 8 values per cue); with no history, this Take's own
    clips once there are 6. With neither, the clip has no sound read.
  - Each is turned toward "confident": a wider pitch and loudness range,
    less pausing, a lower pitch, faster speech, a falling end and loudness
    that eases off count up; their opposites count down.
  - The cues are averaged with fixed weights: loudness range 0.20, pitch
    range 0.18, pausing 0.18, mean pitch 0.13, speech rate 0.13, the
    falling end 0.09, the easing loudness 0.09. A cue that could not be
    measured leaves its weight out; fewer than 3 cues is no sound read.
  - A neutral zone: 0.25 comes off the size of that average, so a clip
    within 0.25 of the speaker's usual reads exactly 0. The rest goes
    through tanh, which keeps it between −1 and +1.
  - Stretched to 0 … 1: S = (read + 1) ÷ 2, so −1 → 0, 0 → 0.5, +1 → 1.

  **Step 2 · W, the words**, read on the clip's own transcript with its
  hesitations (the Ideal Text smooths "um" away; this read does not).
  - **Fillers** = 1 − (fillers per 100 words) ÷ 10, never below 0. Only the
    ten unambiguous fillers count: um, uh, uhm, erm, er, ah, hmm, mmm,
    basically, literally. "So", "like", "right", "you know", "actually",
    "well" and "just" never count.
  - **Hedges**, on the same line: the 36 unambiguous hedges, among them "I
    think", "I guess", "I believe", "sort of", "kind of", "maybe",
    "perhaps", "probably", "possibly", "seems", "likely", "or something"
    and "to be honest". "Might", "could", "would", "should", "quite",
    "often" and "pretty" never count. A hedge counts wherever its words
    stand: "I think about it" counts (H3's rewrite rule knows better; this
    count does not).
  - The line for both: none → 1, 3 per 100 words → 0.7, 5 → 0.5, 10 or more
    → 0.
  - **Slide fit**, from the point-by-point check run when the Take is
    processed. The slide is split into its points (its title and each line
    of its body; for the clips inside the processing budget a model writes
    the points and checks each one against the clip). Each point is
    covered (1), partly made (0.5) or not (0), and the clip takes its best
    point, so one sentence is never marked down for not saying the whole
    slide. Without the model, a point is covered when 6 in 10 of its words
    longer than two letters are in the clip, and partly made from 1 in 4.
    Under 4 words, or a slide with no text, gives no slide fit; 3 seconds
    or more of silence on a slide gives 0.
  - W is the mean of the signals present. One that could not be read is
    left out; with none at all, W = 1, and the voice alone orders the clip.

  **Step 3 · willfidence = S × W.** A clip with no sound read takes S = 0.5
  so its words still order it (2026-10-17). It is under the floor by
  construction, the coach sees no Willfidence line for it, and the Take's
  column leaves it out.

  **Step 4 · where the number goes.**
  - The pick (H1): the Take's two highest, one per block; clips of 5 words
    or more first, then a clip that already holds its slide's helper words
    after the rest, then the willfidence, counted a little less on a slide
    with helper words when the Take was recorded and in the part of the
    talk the last walk praised (N546; was N543, untouched slides first).
  - The praise's opening line (C2): a praised moment's level, by the lower
    bound of each: W10 0.95 · W9 0.88 · W8 0.80 · W7 0.70 · W6 0.65 · W5
    0.60 · W4 0.50 · W3 0.40 · W2 0.30 · W1 below. It goes out as
    `level_key`, never the number.
  - The coach, after their own blind answer: "Willfidence", the clip's
    S × W in whole percent (coach panel E1, N104).
  - The founder's Takes table: the mean over the Take's clips that have a
    sound read, in whole percent (N105).
  - Not by it: whether a shown moment is praised or corrected (the voice, S,
    decides, N108), whether a try is better (S alone, +0.05, H1), and the
    "high, neutral, low" of judging (N101), which are the voice read's own
    bands.

  **Three clips on one slide.** The slide: "Why we release every week" /
  "Smaller changes are easier to test." / "Customers get their fixes
  sooner." / "One release train for every team." The cue values are made
  up for the examples; every number after them is what the code gives,
  with slide fit from the word-overlap check.

  *Example 1 · a strong voice, clean words: 75%.* "Every week we ship
  smaller changes, and those are easier to test. When something breaks, we
  know exactly which change did it, and our customers get their fixes
  sooner. I think that alone pays for the switch."

  ```
  voice   each cue's z, turned toward confident, × its weight
          (all seven measured, so the weights add up to 1):
            loudness range  +1.5 × 0.20 = 0.300
            pitch range     +1.5 × 0.18 = 0.270
            pausing         +1.0 × 0.18 = 0.180
            speech rate     +0.9 × 0.13 = 0.117
            falling end     +0.9 × 0.09 = 0.081
            easing loudness +0.5 × 0.09 = 0.045
            mean pitch      +0.2 × 0.13 = 0.026
                                    sum   1.019
          1.019 − 0.25 = 0.769 → tanh → +0.646
          S = (0.646 + 1) ÷ 2 = 0.823
  words   37 words
          fillers  0 → 1.000
          hedges   1 ("I think") = 2.7 per 100 → 0.730
          slide    every word of "Smaller changes are easier to test." → 1.0
          W = (1.000 + 0.730 + 1.0) ÷ 3 = 0.910
  willfidence  0.823 × 0.910 = 0.749 → the coach sees 75%
  ```

  The voice reaches the floor (0.823 ≥ 0.6) and the words need no help,
  so if shown it is praised, at level W7.

  *Example 2 · a good voice, cluttered words: 30%.* "Um, so the idea is,
  uh, we release more often, maybe every week, and I think our customers
  would get their fixes sooner, which is basically the whole point of it."

  ```
  voice   the weighted cues sum to 0.554
          0.554 − 0.25 = 0.304 → tanh → +0.295
          S = (0.295 + 1) ÷ 2 = 0.648
  words   31 words
          fillers  3 (um, uh, basically) = 9.7 per 100 → 0.032
          hedges   2 (maybe, I think) = 6.5 per 100 → 0.355
                   ("so", "would" and "often" are not counted)
          slide    4 of the 5 words of "Customers get their fixes
                   sooner." → covered → 1.0
          W = (0.032 + 0.355 + 1.0) ÷ 3 = 0.462
  willfidence  0.648 × 0.462 = 0.299 → 30%
  ```

  The voice reaches the floor but the words need help (fillers, H3), so if
  shown it is corrected with the Clearer version; when no rewrite passes
  the gate, it is praised instead (N108).

  *Example 3 · a weak voice, clean words, partly on the slide: 22%.*
  "Every team ships on the same day, with the same checks, and nobody
  waits for anybody else."

  ```
  voice   the weighted cues sum to −0.764
          0.764 − 0.25 = 0.514 → tanh → −0.473
          S = (−0.473 + 1) ÷ 2 = 0.264
  words   17 words
          fillers  0 → 1.0
          hedges   0 → 1.0
          slide    3 of the 6 words of "One release train for every
                   team." → partly → 0.5
          W = (1.0 + 1.0 + 0.5) ÷ 3 = 0.833
  willfidence  0.264 × 0.833 = 0.220 → 22%
  ```

  Good words, a quiet voice. If shown, the voice is under the floor and
  the words need no help, so it is corrected with the voice Exercise.

  *The three as one Take*, each clip in its own block:

  ```
  rank  clip  S      W      S × W  shown  what it gets
  1     1     0.823  0.910  0.749  yes    praised, W7; the most confident
  2     2     0.648  0.462  0.299  yes    corrected, the Clearer version
  3     3     0.264  0.833  0.220  no     —
  the founder's Takes table: (0.749 + 0.299 + 0.220) ÷ 3 = 0.423 → 42%
  ```

  Clip 3 has the better words and clip 2 the better voice; S × W puts
  clip 2 ahead. Had clip 3 no sound read, it would stand at 0.5 × 0.833 =
  0.417, be shown in clip 2's place and be corrected (no sound read is
  under the floor); the coach would see no line for it, and the Take's
  column would be (0.749 + 0.299) ÷ 2 = 52%.

  **The other reads under the same name** (backend SPEC §17; never shown
  as a number):
  - `willfidence-v1-machine`, the dark read of a moment: one block of the
    Take's frame (about 75 words, one clip or more). S is the mean of its
    clips' sound reads, then stretched; a moment with no sound read is
    unrateable, with no 0.5 in its place. Fillers and hedges are counted on
    the block's whole text, slide fit is its best clip's, and W has a
    fourth signal, holding together (1 yes, 0.5 partly, 0 no, from the one
    model call per Take). It adds the four boxes, which sum to 1:
    willfident S·W, hollow S(1 − W), hidden (1 − S)W, lost (1 − S)(1 − W).
    Clips 1 and 3 as one block, the call saying "partly": S = ((0.646 −
    0.473) ÷ 2 + 1) ÷ 2 = 0.543; W = (fillers 1.0 + hedges 0.815, one in 54
    words + slide fit 1.0 + holding together 0.5) ÷ 4 = 0.829; S·W = 0.450,
    hollow 0.093, hidden 0.379, lost 0.078. A Take's (and a speaker's)
    willfidence here is the mean S·W over its seeded random fifth of
    moments (ceil(blocks ÷ 5)); over 30% of them unrateable reads "audio
    problem", fewer than 10 rated "not enough data". A Take needs 46
    blocks, about 3,450 words, to draw 10, so one Take alone nearly always
    reads "not enough data"; the speaker's line gathers over their Takes.
    It feeds the closing summary, in words (whether the voice and the
    words rose since the last Take, and the moment with the strongest
    voice; D), the dark V4 picker, the reached bar and the coaches' "Which
    sounds surer" sheet.
  - `willfidence-v1-machine-fast`, the read of a practise try: S, and W
    from fillers and hedges only, so it is back within 5 seconds.

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
  is plain text with no picture of its sender (N301). The speaker's part is their voice;
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
- **J6** The shape of a run (founder 2026-10-30, N286, as Messenger draws
  it, on the preview <https://claude.ai/artifact/HjKX9XgJZFnnfZt3QQFGX9>):
  no bubble has a tail, in the Lounge and in the walk. A bubble's open side
  (the right of a grey one, the left of an orange one) is round at both
  corners, always. On the side the bubbles line up on, the corner where a
  bubble meets the next one of the same side is drawn in to 6px; the top of
  a run's first bubble and the bottom of its last stay round, so a bubble
  alone is round all round (`globals.css`, `data-row` and `data-bubble`). In
  the walk every bubble stands apart, so each is round all round, two of
  the speaker's tries in a row included (`[data-walk-thread]`, N440; was:
  the corners between two tries drawn in to 6px).
  Was: every corner round and a small tail on the last bubble of a run
  (2026-10-14).
- **J7** Every choice in a chat, anywhere in the app (founder 2026-11-04,
  N467, signed and locked for the whole app on the page "Will's Chat, to
  Sign" <https://claude.ai/artifact/74vqKTfEVgNeHfRgW2NyqL>, version 2).
  Will's chat starts at the bottom, by the bar, as the chats with people
  do (N321 item 3); once it fills the screen nothing changes, and there is
  no extra room above the first message (`Lounge.tsx`, the thread's first
  child `mt-auto`). Four rules, one component each (`WillQuestion.tsx`):
  your answers sit on your side, on the right, right under the question;
  one answer look, N371's orange pill with the likely answer filled,
  whoever asks (`TapRow`, `AnswerPair`); saying no is a grey word, "Not
  now", "Skip", "Cancel" and "Close" never get a pill (`TapRow` draws
  those four as a word wherever they are offered); going somewhere is a
  link on Will's side, a line of text with › and no card (`ChatLink`):
  "What would help?"'s "Your presentations" and "Create new project",
  "Replace PDF", "Open exercise", "Review coach feedback", "Open speaker",
  a product's action and the coach's "See the feedback", with "Skip" a grey
  word on the right. A card says what happened and its answers sit under
  it on your side: under "I couldn't create your Ideal Text this time.",
  "View this take's feedback" and "Try creating it again", filled. The
  black-and-grey pairs in the chat are answers under their grey card: a new
  project (Cancel, Continue), the slides (Cancel, Upload PDF), the WhatsApp
  number (Not now, Save; then Not now, Continue). The consent ask, the
  policy update and the one-project sheet keep their black-and-grey pair
  (`SymmetricPair.tsx`). A yes-or-no ask has "Yes" last; the 1 to 10
  scale's picked number is orange ([the plan's page](the-plan.md) B10).
  Orange is what you say, grey is how you leave, black is the one thing to
  do on a screen ("Record Take 2", "Accept and practise"). Stays: Will's
  question chips, the walk and the lenses, the bar's one command and the
  emoji bar. Was: Will's chat started at the top; offers' "Not now" an
  outlined orange pill (N415) and the plan's a faded grey pill; grey cards
  with ›, small outlined buttons and buttons inside Will's cards; black and
  grey pills; the picked number black and "Yes" first.
- **J8** The rhythm of a run (founder 2026-11-04, N469, as on WhatsApp, on
  the page "Getting To Know You"
  <https://claude.ai/artifact/LD1cXKQA8t4T5B6H92FErs>, version 10), in
  every chat: Will's and every chat with a person. Two rows of the same side
  in a row sit 2px apart; where the side changes, 12px; anything else in
  the thread (a day's line, a card, the answers under a question, a link)
  keeps 8px. With J6's shape, a run reads as one block (`globals.css`, "THE
  RHYTHM OF A RUN", on `data-rhythm` and `data-row`; `Lounge.tsx`,
  `chats/ChatThread.tsx`). The walk keeps its own spacing: every bubble
  there stands apart (J6). Was: 8px between every row.
- **J9** One space around every bottom bar (founder 2026-11-04, N505, as
  on WhatsApp, on the prototype "Bottom Bar Spacing"
  <https://claude.ai/artifact/2riV2BjMgYdESpBv7piuhi>, version 3), everywhere
  in the app: a bar at the bottom of a screen keeps 8px from the bottom edge,
  8px from each side, and what scrolls above it stops 8px above it. 8px is
  the space the bottom already measured. A bar that ends in a grey word
  ("Close", "Cancel") adds nothing under it: the word's row holds its 8px
  (N280). A phone's home-bar strip stays the space below where it is bigger;
  on a computer the 8px is inside the page's column. One rule, `bar-space`
  in `globals.css`; inside the app's shell a bar pulls out of the shell's
  16px sides (`-mx-2`). The bars: Will's chat and every chat's bar
  (`Lounge.tsx`), "Record Take N" and "Close" (`IdealTextOverlay.tsx`,
  `IdealTextReadout.tsx`), the walk's footer here and in the coach panel
  (`WalkFooter.tsx`, `WalkSheetFrame.tsx`), the plan's answers and button
  (`LoungeLifeGoals.tsx`, `plan/PlanCalendar.tsx`), the recording screen's
  buttons (`RecordingRoadmap.tsx`), the transcript's Save
  (`TranscriptReviewDeck.tsx`) and the welcome example's button
  (`WelcomeExample.tsx`). Sizes, words and the gaps inside a bar do not
  change; a slide-up sheet is a card and keeps its own padding. Was: 16px
  sides; 0px above the chat's bar and "Record Take N"; the walk's footer and
  the plan's answers 20px sides and 30px under.

### K · Words on screen (all signed)

- **The One thing walk (N309 item 6, signed 2026-10-31, "please implement"
  2026-11-02; `ONE_THING_COPY`, `idealEditCopy.ts`):** "Hi {name}." (no
  name: "Hi."), "Last time: {the tip}. You did.", "Last time: give
  “{words}” more room." (the pace game's, signed 2026-11-02, N347 item 3,
  `paceTip`), "To our ears, this one sounded really sure." and "To us, this
  one sounded really sure." (N565), "Why it worked: {the moment's signed cue line}",
  "And here's one moment to try another way:", "The rest of this Take held up just as well." (N551, N557),
  "Say it straight:", "Say this one like
  your confident moment:", the tip ending ", like this:", "Your
  confident moment" (the chip, N379), "Try it", "Keep mine", "Your words
  it is." (N435), "You rushed here. Let it breathe." (N435), "You slowed
  down here. Keep it moving." (N452), "Skip",
  "Okay, we'll skip this one." (N405), "Yes. That's it.", "Close. Once more.",
  "Good try. Take it with you.", "Let's see how you find this voice. It
  helps us understand you and serve you better.", "Does this sound
  confident to you?", "{face} {answer} ✓", "Got it.", "These are your helper
  words. They'll appear on screen during your next take, to remind you of
  what you learned here.", "Lesson done.", "Close". Steady tone only: the
  prototype's gentle and straight lines are not built. Never varied (N123).

- **One bubble never says the same thing twice** (founder 2026-10-30, N283,
  on a screenshot of the Take's highest moment: "This was your most confident
  moment. Wow, great job. That really landed! 🔥 It was your confident
  moment."). Every grey praise bubble, in the walk and in the chat, is
  stacked from its signed lines and then passed through one check
  (`withoutRepeats`, `src/lib/willab/walkLines.ts`): a sentence whose gist an
  earlier sentence of the same bubble already said is dropped; the first one
  and every other word stay. Nothing is reworded and no word is added.
- **The signed words stay** (founder 2026-11-02, N338 item 2, which
  withdrew N123): each ask after the Take (E1, E2, the CEO panel's
  included) and each of the walk's own lines is said as the founder signed
  it; nothing is written fresh by a model. Where a line has a signed bank
  (the AI clip's openers and tips), the bank rotates, never the same line
  twice in a row (the AI clip's bubble, above). Was (founder 2026-10-23,
  N123, withdrawn by N338 item 2): **said fresh, from the
  signed meaning**, each ask and each of the walk's lines said fresh for
  this speaker and this Take around its signed line, checked, the signed
  line the fallback.

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
  "Skip", "Practise", "Practise again", "Stop", "Close",
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
  words"; after "Keep my words", "Your words it is. Now say them like you
  mean every one." (signed 2026-10-29, N268); the quote's words after a Good
  job are on [`principles.md`](principles.md) §1 K; for undermining words B10's "Say what you mean. Don't dance around
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
  turn." (the first bubble; not in the One thing walk's fix, N379 item 3)
  or "Try again." (after a try that is not yet
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
- **The weakest** (N289 item 7, signed 2026-10-30): "Here's one with
  more in it." above its clip; "Your confident moment" on the strongest
  moment's clip played again under Line A.
- **Practise:** Line A "Say this one like your confident moment."; "That
  sounded more assured than the first."; the praise, not-yet and move-on
  lines of the signed bank (backend [`docs/SIGNED-line-bank-2026-10-06.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/SIGNED-line-bank-2026-10-06.md),
  `services/line_bank.py`); the opening lines W1–W10
  (`src/lib/willab/praiseLevels.ts`); the AI clip's L1–L18 (backend
  [`FOUNDER-LOCK-ai-voice-practice-2026-10-12.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/FOUNDER-LOCK-ai-voice-practice-2026-10-12.md)).
- **Between the moments:** "Okay, thank you for that, let's look at your
  next key moment we spotted." and "These were some real good moments of
  yours, thanks for that practice – we are really moving forward." (signed
  2026-10-30, N285, the founder's own words, C7a).
- **Other speakers:** Line B "Now one moment from another speaker." / "Now N
  moments from other speakers." / "Now one moment from {community}."; "Does
  this sound confident to you?"; "Yes", "In-between", "No", "Audio unclear".
- **Sharing:** "Before we start the new take!", "After all, it's about
  speaking publicly!", "How big you want your audience?", "General
  community", "Only my community", "Only me", "+ Add a community with a
  passcode".
- **The Ideal Text:** "Record Take N", "Close".
- **The goodbye after a Take** (signed 2026-10-31, N294 item 6; N319 item
  7; N347 item 2): "Good job. See you next time." · on a plan "Good job.
  See you tomorrow." or "Good job. See you {weekday}." (signed 2026-11-02,
  N347 item 2) · "{n} of {total} practices done." · then "Record Take N"
  in the bar (N483; was the tap "I want to continue my practice" first).
- **The bar at the top** (N295, N391): "It seems you enjoy using
  WillpowerLab." over the WhatsApp ask; the CEO panel's lines as written
  (E1). The home screen's ("Well, I can see you're doing pretty good.") is
  deleted with its ask.
- **The one ask:** "Did this help?", "We're glad it helped you.", "What
  would help?", "Skip"; Will's lead-ins (E1) are his own words around the
  ask's signed text, checked; Will's questions and tap answers as signed in N82
  (backend `services/will_question.py`; the questions may vary lightly from
  2026-10-20, the tap answers never), opened on the walk's moment with
  "When you said “…”, " or "We just worked on “…”. " (signed 2026-10-31,
  N294 item 1): "Who were you talking to? 🎯" (signed 2026-11-02, N347
  item 1); "When you finish, what do you want them to do? Or feel? 🤔";
  for a talk to themself "When you finish, what do you want to do? Or
  feel? 🤔" (signed 2026-11-03, N406 item 4);
  "Last time we practised “…”. It didn't make it into this Take. On purpose?
  😏" (Yes, on purpose · I forgot · It didn't feel like me); "You've put real
  work into this one 💪 Need a breather, or does something feel missing?" (A
  breather · Something's missing · All good, keep going); "Zoom out with me
  🔭 Does this talk take you where you want to go?" (Yes · Not sure · Not
  really); "Which part of this talk is most you?"; "Why does this one matter
  to you?"; "If this talk goes perfectly, what changes for you?"; the
  follow-ups "Who is it for, then? 👀", "Tell me more 👀 What's missing?",
  "What would feel more like you?", "What would make it a yes?", "Where do
  you want it to take you?"; "Got it, thanks 🙏"; "{who}. I'll keep them in
  mind." (signed 2026-10-31, N294 item 5), {who} from the speaker's side,
  "your" for "my" (signed 2026-11-03, N406 item 3); "I'll keep you in
  mind." (signed 2026-11-03, N406 item 3); "Sounds like this one's for {the
  board}. Right? 🎯" (Yes · Someone else); the answers by field
  (business: My team · Leadership · A client; public speaking: A big room ·
  Colleagues · Friends and family; sales: A buyer · Their team · The decision
  maker; customer service: A customer · A caller · My team; interviews: The
  hiring manager · A panel · A recruiter); goal: Say yes · Trust me · Get it;
  the key line, the plan's signed question (the-plan.md K, N140; after the
  walk N294 item 2): "If {who} remembers one sentence from you, what is it?
  Say it the way you'll say it.".
- **Recording** (N314): "Stop" in the one recording bar (the tempo step's
  word).
- **The Sunday note and life goals:** their words are on [`principles.md`](principles.md) §1 K (N182).
- **Signed, no longer shown in the One thing walk** (N309; a Take served
  before N289 still shows them): "Choose your helper words" and the
  picker's words in the walk (they stay for F5), Line B, "Here's one with
  more in it." and "Your confident moment", N285's lines between moments,
  the AI clip's openers in the walk, "Good job" over a try, the praise
  level lines W1–W10 and the reason bubble, "Hi {name}, good to see you
  back!".
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
  N245: Will decides when the game ends); "Look, practice makes perfect.
  If you're ready, let's go with the next take. 💪" (N89; gone with N294
  item 6, 2026-10-31); "Skip" under Will's questions (N296 item 2);
  "Quick one: who's this talk really for? 🎯" and "Good job. See you next
  {day}." (2026-11-02, N347 items 1 and 2). The praise keeps its own lines
  (N122: the one-sentence praise of N120 was dropped before it was built).

### L and M · The Sunday note and life goals

Moved to [`principles.md`](principles.md) with their letters (backend N182):
the principles are their own feature, ring 6, apart from the speaking coach.
The walk, the plan, the coach panel and a Take's feedback never read or show
them.

---

### T · The tempo step (the pace step)

Founder 2026-10-24 to 2026-10-28, backend N162, N166, N179, N181, N245. Built: whoever the rings panel's `tempo_step` row reaches sees it; at ring 0 it reaches everyone, the founder too (N325 item 3). Everything about this feature is in this block; it moved here from §2 when its build steps were done (docs audit, 2026-10-26).

**In one line.** After a Take where the speaker rushed or dragged, the walk
plays that stretch back and asks them to talk about the same thing again
while a dot on a scale follows their pace live.

**Where and when** (N162, N178).
- In the Feedback walk only. Never in the coach panel, the Lounge, or before the Take.
- **Opened again** once the walk is done, it shows what the chat kept, read only: the stretch, Will's opening lines, each "Try N" with the line the dot drew and Will's word on it, the closing line (none after a try that landed) or the Skip, and no Next (N259). No scale and no microphone. A Take that had no tempo step has none (N247). The same, without its Next, when the walk is opened again further on before it is done (B5).
- It sits before the Ideal Text, so it always has a Skip (N178, which replaces N130's "never between a Take and the Ideal Text" for the walk's own practice steps). The walk has no time limit: it ends when the speaker taps Close (N347 item 5; N178's time limit is withdrawn).
- In the One thing walk it is the Sniper, the fix, and then no moment is fixed: on a plan's pace or pause week whose Take has a stretch outside the green (N309 item 1), and, for everyone, with or without a plan, at any level, whenever rushing is the Take's biggest issue (N323 item 6). Rushing is the biggest issue when the stretch ran fast and the share of its time the pace scale spent past the green is larger than what each moment the walk could fix falls short of, 1 minus its willfidence (S × W, the read the picker ranks the moments by, H); both are shares from 0 to 1 where 0 is all well; a tie, or a moment with no read, keeps the moment; with no moment to fix, a rushed stretch is the fix. A plan's level moment (N289 item 8) counts as a fix like any other, so the plan's choice stays unless rushing outweighs it. A slow stretch off a pace or pause week leaves the fix a moment. Only for a speaker the step reaches (below): without it the walk could not show the Sniper, so the fix stays a moment (backend `take_feedback_policy_v3._sniper_first`). Was (N309, 2026-11-02): only on a plan's pace or pause week. Under "And here's one moment to try another way:", the stretch's clip, then, for a rushed stretch, one bubble, "You rushed here. Let it breathe.", with the pace scale in it, in place of the opening lines below (backend N435 item 6, the locked prototype's `scale()`; a slow stretch opens the same way with "You slowed down here. Keep it moving." (N452 item 2; was: T's lines); a plan week's level line stays); its slide in the bar (N435 item 7; was "Tempo"); "Try it" with Skip in "I'm ready"'s place, the recording bar alone while it records, its trash the Skip (N435 item 3), two tries, and the walk's words on each ("Yes. That's it.", "Close. Once more.", "Good try. Take it with you."), no closing line of its own; Skip moves the walk on at once, after a try too (`WalkTempo` `one`). With a moment to fix that outweighs the rushing, the walk has no tempo step. Was: on any Take, Take 1 included, whenever the pace scale finds a stretch outside the green, once in that walk, with or without a plan (N289 item 6; was from Take 2, N181, a rule the code never had), as a Take served before N289 still has it. Right after the walk's moments, so a Take that needs both has the Clearer version first, then this step (C2). In a "Let your key line land" or "Pauses that hold the room" week it opens with "This week's level: {level}. Here's where it shows:" (N289 item 8). Who has it is the rings panel's `tempo_step` row, at ring 0 (N325 item 3); the walk's choice of the Sniper reads the row alone (backend `tempo_stretch.tempo_on_for`; was: also the founder reading their own Take, N350 item 1).
- It is the founder's "Sniper": the pace exercise of N129. The old Strength/Pace dartboard stays retired (N127, N181).

**The scale.** A dot on a horizontal line. It moves right while you talk
and left while you pause. Green in the middle, orange towards the ends,
red at the edges. Under it, left to right: "too slow", "just right", "too
fast" (N405; was: no labels). No number, ever (Never 1). How the dot moves is settled:
backend N142, `docs/SPEC.md` §17 `pace-scale-v1`.

**The step, in order** (as drawn in [Tempo in the Walk](https://claude.ai/artifact/VJd5MeFGgZy7e3Q8M1EQXV)):

1. The speaker's clip, with the rushed or dragged stretch marked: their orange bubble, the sentence with the stretch marked above the player of that stretch (the walk's `WalkPlayer`, look "me", as a moment's clip is; the locked prototype X4gDmGfHH7ivuoRZ9ufiy9 `clip(f.text)`). The audio is the stretch's own clip, signed as the moments' are (backend `tempo_stretch.with_clip`); with none, the words alone. The same when opened again.
2. Will's bubble, from what the stretch was: "That part went fast. 🏃 Let's try a little game." or "That part slowed down, with long pauses. 🐢 Let's try a little game."
3. Will's bubble with the stretch's topic: "Tell me more about {topic}, and keep the ball in the green."
4. Will's bubble: "🤫 Find a quiet spot first."
5. The scale, asleep, and **I'm ready**. Tapping it wakes the scale and starts the recording bar, the app's one recording bar (N314): the trash, then the strip with Stop inside it, nothing under it (founder 2026-11-03; was the Skip under it). Stop shows once the mic is live, as in the walk's practise (C7, N350 item 5). Nothing else appears until Stop. The trash throws the try away: no try is counted or kept for Will, and the step is back where it was before it (I'm ready, "Try it" or Practise again); in the Sniper the trash is the Skip instead, and the walk goes on with "Okay, we'll skip this one." (backend N435 item 3, N448).
6. The try: the dot's path, then Will's word on it; Will guides, the speaker never has to choose between another try and moving on (N245):
   - **It lands** (really better): "That landed. 🎯 Really better. Let's move on.", then **Next**; the game ends there, on any try.
   - **It came closer** (more than half in the green, not enough to land): "Better. You let it breathe." and, while a try is left, "You're close. 💪 Give it one more try.", then **Practise again**.
   - **Not yet**: "Still rushed. Take a breath after each offer." / "A bit slow. Keep the words moving between the pauses.", then **Practise again**.
7. After the third try without a landing, a one-line summary (for example "Dynamic. You paused where it mattered. 🔥"), then **Next** and the walk goes on. The Skip stays at the start and between tries (N178 item 3), never under the recording bar while a try records (step 5); in the Sniper the trash is the Skip, and moves the walk on (backend N435 item 3, N448). Was (N178 item 3): the Skip during each try too.

Once the walk goes on, the game stays in the thread as it was played (B5): each try with the line the dot drew and Will's word on it, and the closing line (none after a try that landed), or the speaker's "Skip" as their own bubble; the scale shows only while the walk stands on the step (founder 2026-10-28). A walk opened again further on draws the game as the chat kept it, never only its opening lines (founder 2026-10-28: "It feels like the practice is gone from the feedback walk").

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

**When the pace fix worked** (N350 item 3, one rule). The stretch the pace
game fixed counts as fixed when every clip on that slide in the next Take
stays inside the green on that side: each spends less of its time past
the green on the side the stretch leaned than the bar that picks a stretch,
a quarter (`tempo_stretch.MIN_OUTSIDE`; `tempo_stretch.stays_inside`). It
is the rule for "Last time: give “{words}” more room. You did." (C0a, N347
item 3) and for the founder's Takes table's "did the fix work" for the
pace game (backend `take_progress`), the same rule for both. Was:
any drop for the walk (every clip on that slide spent less of its time past
the green than the stretch did), a moved stretch for the table.

**The build, in order** (N166 item 5):

| Step | What | Where it stands |
|---|---|---|
| 1 | The meter and the scale move from the bench to shared code; the walk gets its list of interventions, empty by default | Built |
| 2 | The step's screen in the walk, founder-only, on a stand-in stretch (the beds for sale) | Built |
| 3 | The Take's own stretch, its reading and its topic: the backend replays the pace scale's rules over the Take's word timings and takes the clip furthest from the green; the topic is one small-model call under the Take's processing authorization, else "that part"; no stretch, no step | Built |
| 4 | Kept: the step's lines, each try and its comment, and the closing line are Lounge messages like every other step; the game (the stretch's reading, each try's result and the dot's path, how it ended; never audio) is one speaker-memory event, so Will's note learns it in words | Built |
| 5 | The words signed (N179) and listed in §1 K | Built |
| 6 | Who sees it: whoever the `tempo_step` row in the rings panel (`/admin/rings`) reaches; no row, nobody else. The backend answers the step only to them. The row is at ring 0, so it reaches everyone (N325 item 3): a speaker without a plan when the Take needs it, a speaker with a plan in a pace or pause week (N147, N181) | Built |

**The code.**
- The plan: `src/lib/willab/walkPlan.ts`, `WalkIntervention` and the `tempo` step key. A new intervention is a new kind there, its place in `buildWalkPlan` and its screen.
- The step: `src/components/willab/walk/WalkTempo.tsx`; played again, or drawn from nothing in a walk opened further on (`TempoOrKept` in `FeedbackWalk.tsx`), `WalkTempoSaid.tsx`, from the chat's lines (`tempoSaidIn`, `src/lib/willab/walkThread.ts`; each try's message keeps the dot's path in its metadata); what a try means, when it lands and what Will says to it (`readTry`, `landed`, `afterTry`) and the signed words (`TEMPO_COPY`): `src/lib/willab/tempoStep.ts`. A landed try is kept for Will as a better try and the game as ended dynamic (the backend's words for the game are unchanged).
- The meter: `src/lib/willab/pace/` (`paceSignal.ts`, `paceMic.ts`); the scale: `src/components/willab/pace/PaceScale.tsx`.
- The stretch: backend `services/tempo_stretch.py` (route `GET /v2/explore/arc/<arc>/review/tempo/<take>`), asked once per Take by `useReviewTempo.ts` through `src/services/api/reviewTempo.ts`. The scale reads slow only on pauses of several seconds, so most stretches it picks are rushed.
- What is kept: backend `POST /v2/explore/arc/<arc>/review/tempo/<take>` (`tempo_stretch.keep_tries`, a speaker-memory event of kind `take` with its `tempo` part, docs/SPEAKER-MEMORY.md), sent by `postTempoGame` in `src/services/api/reviewTempo.ts` when the game ends.
- Who sees it today: everyone the rings panel's `tempo_step` row reaches, at ring 0 everyone (the backend decides: the walk asks the tempo route at once, with no ring read of its own since N458; backend `tempo_stretch.tempo_is_on`, the founder or the row, and `tempo_on_for`, the row alone, for the walk's choice of the Sniper). To try it on the dev harness: `/dev/feedback-walk?live=1&tempo=1` (the stand-in stretch).
- The founder's bench, `src/app/admin/pace-circle/`, uses the same meter and scale.

**History.** The [Pace Circle brief](https://claude.ai/artifact/VJ2uSugQWmbAsmReyxuufz)
(2026-10-24, N130, N133): a circle with three reads, replaced by the scale (N142).

## 2. In flight

One line per piece of work: `item · what it is · the rules it touches ·
where it stands · PR`. The session doing it fills its line in its PR and
deletes the line when the work is merged (the change goes to §6).



- **The plan** (backend N129 onward) · the diagnosis, the plan card, the practice days and the plan's end have their own page, [`the-plan.md`](the-plan.md); it meets this page in the Lounge, in the walk's level moment (C, N134 item 2), the bar on the end sheet (N140 item 11) and the pace practice in a pace week (the tempo step), and in the chat's day line before each day's first message (N169, the-plan.md G3) · decided, not built · its rules live there, not here (backend N160). Built, on for ring 5 since 27 October 2026 (N203, N204, backend #1394): the plan in the Lounge, and the bar with "{n} of {total} practices done. Next: {day}." on the walk's end card (`WalkEnd.tsx`, `PlanProgress`); and since 27 October the level's moment in the walk (H1, N209: "This week's level: {level}. Here's where it shows:" above the clip, `LevelHere` in `FeedbackWalk.tsx`)

- **WIL-76** · the stale processing step (urgent) · A1, A2 · confirmed in the app 2026-10-20 ("it doesn't open right after the processing"). Built: the marks are baked in the run right after ready (BE), the processing bubble waits for them and the page keeps asking for late marks to its ceiling and closes its slot when it stops (FE) · BE #1209, FE #896 · the founder checks the app
- **WIL-89** · the lens as one chat: the opening order, the lenses, the interventions × chat awareness · B, C1, F · built and merged: FE #868, #882, #885, #886; BE #1170, #1190, #1194, #1196. Whether it works as drawn is the founder's check in the app ("success?") · to confirm
- **WIL-84, WIL-86** · videos match (the coach's changed word and video, N80) · C1, D5 · built and merged: BE #1160, FE #861, FE #872 (the speaker's side). The coach's later change shows in place with "Edited" (D5, N192)
- **WIL-90** · the exercise is blocked · C6, C7 · BE #1206 fixed the coach's gate; built 2026-10-20: the Manager's exercise offer, the verbal-cue gate and the error-presence audit read the speaker's own page too · BE #1209 · the founder checks the app

The four lines above were filled from main's history by the page's keeper on
2026-10-20; the sessions doing the work overwrite them when they push.
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

- **Tempo · the pace step** · §1 T · built; it reaches whoever the `tempo_step` ring row reaches, at ring 0 everyone (N325 item 3; the founder-only fallback in the walk's choice of the Sniper is gone, N350 item 1). Left: the plan's pace weeks, which wait on the plan (N147) · the founder decides when

## 3. Still open

- **From N467's audit (2026-11-04), for the founder:** choices in a
  chat that the signed page did not show, left as they are until a ruling
  on J7:
  - **The Ideal Text cards' own buttons:** "View Ideal Text" inside the
    best-version card and the Ideal Text card's black button
    (`ReportCard.tsx` `IdealTextHeroCard`, `IdealTextCard`): a button inside
    Will's card, or "the one thing to do".
  - **The plan's "See your plan"** (an underlined word inside Will's hello)
    and **"Choose a date"** (a black pill in the summary call's card)
    (`PlanRows.tsx`): a link with ›, an answer, or "the one thing to do".
  - **"Try processing again"** (a full-width outlined pill above the bar,
    `Lounge.tsx`): one answer, or "the one thing to do".
  - **Will's bubbles that open a lens** with a › on them (the Sunday note,
    life goals, your why, a strength, the AI voice, a walk): his message
    itself, kept as it is, or a link under it.
- **From the walk's audit (2026-11-04, N458), for the founder:**
  - **No tip when the AI voice is off,** deleted, or practice consent is
    off: C4 and N370 list only a failed check, refused limits and no voice
    yet; the AI voice page says the tip stays.
  - **Switching sentence after a try:** a Clearer practice that already
    has a try on one sentence stays on it when the speaker taps the other.
  - **"Did the fix work" reads the dark frame,** which picks by rank, not by
    what could be served, so for a sentence kept with "Keep my words" and
    said again it can name a fix the walk never gave. Storing the served
    fix needs a migration.
  - **A non-answer under Will's question** (a "#" note, a typed message
    that is not an answer) still lets the goodbye go: E1 ("a typed message
    passes the ask in front") against N406 item 1 ("nothing lets it go past
    an open question").
  - **The deeper question** now waits for the key line (E2, "with all
    three known"); a key line asked once and left unanswered means no
    deeper question for that talk.
  - **Take 2 of the first project** (the real talk on new slides, N449)
    compares Last time and what worked with Take 1's five questions, slide
    by slide.
  - **The summary is drawn nowhere** (C9 has no summary step; D4 hides it
    in the chat). Nothing waits for it any more (WILL-07): its row is
    written at once with the signed line, `writing` in its metadata, and
    GPT-4o's words replace it in place; while `writing` is true it is "not
    yet", never failed (`loungeScreen.ts`).
  - **N103 is not built:** below three approved exercise videos for a
    mistake, the coach's queue asking Artur to record one. It waits on
    backend #1127 (draft) and the founder's words for the coach panel line.
    Until then the speaker gets the AI clip or its tip at once.

- **The One thing walk, built as closest to N309 (2026-11-02):** "Since
  it was last worked on" is read as "the fix the last walk gave". The
  founder decides.
- **The rule for "rushing is the biggest issue"** (N323 item 6, T): built
  as the rushed share of the stretch against 1 minus each fix moment's
  willfidence, the two reads already there; the founder may want it tuned
  once Takes show how often the Sniper wins.

- **After the walk, as built where the prototype and N294 leave room**
  (2026-11-02, for the founder): Will's questions keep their signed words
  after the moment's opener. A visit is the tab's
  session: the settings ask comes on the first Lounge load of a new
  session after the Take, at most one per Take. Typing "I want to practise"
  under the goodbye is read in the app (practise, record, continue, again,
  next take; never with "no", "not", "later").

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
- **FLOOR** is 0.6 until the blind judges calibrate it (H1).
- **willfidence-v2** waits for 200 settled clips (I3).

## 4. Where it lives

Frontend, guarded by `scripts/flow-pages.txt` (a change must change this
page):

- `src/components/willab/walk/` — the lens: `FeedbackWalk.tsx` (the walk),
  `WalkThread.tsx` (the thread and its scrolling), the steps' screens, the
  recorder strip, the word picker, the AI voice bubble.
- `src/components/willab/WalkEnd.tsx` — the end of the walk.
- `src/lib/willab/walkPlan.ts` — the order of steps from a Take's moments
  (the One thing walk: `oneThing`, its steps marked `one`; N309).
- `ONE_THING_COPY` in `src/components/willab/idealEditCopy.ts` — the One
  thing walk's signed words; `src/services/api/reviewLastFix.ts` and the
  BFF `review/last-fix` route — Last time (C0a); `WalkOthers.tsx`'s
  `level` — the one judged moment (C8).
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
`idealTextLoad.ts` (the page and its loading), `src/components/willab/loungeReports.ts`,
`src/components/willab/WillVoiceAnswer.tsx` (a spoken answer already
given, E3), `src/components/willab/WillQuestion.tsx` (Will's question, its
taps and the box, B14, E2, E3), `src/components/willab/plan/PlanDock.tsx`
(`WillBarMiddle`, the bar's middle, B14).
The Ideal Text's own files are in `scripts/design-locked-files.txt`. So is
`src/components/willab/RecordingBar.tsx` (the one recording bar, B14, C7,
T), locked by backend N314: a change to it needs the `Founder-Approved:`
trailer; shared with the chats and the plan, no flow page names it.

Backend (`wilplus/backend-cursor`): `services/moment_pick.py`,
`services/take_feedback_policy_v3.py` (the marks), `services/willfidence.py`,
`services/rewrite_gate.py` (H);
`services/take_summary.py` (D); `services/after_take.py`,
`services/will_question.py`, `services/feedback_check.py` (E; the spoken
answer's route, `/will-question/voice`, is called for the key line only,
N544);
`services/take_context.py` (the key line, E4, H1);
`services/inner_context.py`, `services/verbal_read.py`,
`services/prompts/verbal_read.py` (the notes, H1);
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
`waitHandover.test.ts`, `waitProgress.test.ts`,
`src/components/willab/recordingBar.test.tsx`, `willVoiceAnswer.test.tsx`,
`takeIntoWalk.test.tsx`;
backend `tests/test_speaker_memory.py`, `tests/test_will_question.py`. Every test's story: `docs/TEST-STORIES.csv`.

## 5. Prototypes

The design is the prototype; the newest wins where two disagree.

- **Current:** Will's hello in the empty Lounge
  <https://claude.ai/artifact/H2CwSoSWXF7wttNEXsPMYb> (N273, 2026-10-29); the
  Feedback walk in the chat
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
  AI voice <https://claude.ai/artifact/G8Am3fR3f3SzAdTkwyUGKZ> (v8); the
  guest's account wall with its one moment
  <https://claude.ai/artifact/LyE1Xa7M5D2FWXDxFzPKtT> (N273 item 5, A4). The
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

- 2026-11-11 · N639 · for the chat builder's ring, what opens from Will's lines (the answers to send, the moments to answer, a model to check, "AI models", "Your chat" with its setup and its parts) has one top bar: the AI models page's arrow and words, at the chats' bars' height with their line under it, the back arrow on the left and the name beside it ("AI models", "Your queue", "Your chat", "Answers to send", "Models to check": the line's own words without the count; the arrow alone where a deeper screen's bar had no words), no circle, no "Back" word, no close, no site bar. It opens over Will's chat, so Back, the phone's included, goes one step and from the first screen to Will's chat, not the list (`OneTopBar.tsx`; the walk's ‹ in `WalkOverlay.tsx` is that bar's, unchanged to see; `useChatsDoor.tsx`, `HostSetupRows.tsx`). "Test my chat" keeps a chat's bar. No new words. Was: the setup and its parts showed "‹ Back", Will's circle and what the person does, the coach panel a ✕, and closing went to the list · FE (this PR)
- 2026-11-11 · N636 item 2 · for the chat builder's ring, a plan row's "See your plan", "Change" or a call to book, tapped in Will's chat or Principles, first opens the speaking chat, where its sheet is drawn, so the tap never looks dead (`speakingFirst`, `askForPlace` in `chats/loungePlace.tsx`; the door opens the chat asked for). Every other tap in those chats opens a screen drawn over any chat · FE (this PR)
- 2026-11-11 · N640 · for the chat builder's ring, Principles opens with "This is where your principles live. Write what's on your mind, and I'll keep it." above everything in it, and the list shows that line under "Principles" until something else is written there; the field reads "Message Will" in Will's chat and "Write here" in Principles, "Type your answer" staying the speaking chat's (`chats/loungePlace.tsx`). Without the ring, as it was · FE (this PR)
- 2026-11-11 · N635, N636 items 1 to 5 · for the chat builder's ring, the one Lounge is three pinned chats, each with only its own rows (every row's `place`, backend #1926): Will (the model, the chat's setup, "This needs you:"; its bar always the text field, no record button, no projects, no plan dock), "Speaking coach" (the Takes, the walk, the plan, the key line and today's bar: the record button at rest, the text field when words are asked or the person taps to type) and "Principles" (its rows, the text field). A link that opens a Take opens the speaking chat; each row has its own line and new dot; what is typed or tapped carries its chat (`chats/loungePlace.tsx`, the door's place in `useChatsDoor.tsx`). The loop is unchanged; without the ring, one chat as it was. What stops for the ring: Takes, feedback notices and the record button in Will's chat; the principles' rows in Will's chat · BE #1926, FE (this PR)
- 2026-11-10 · N632 item 7 · no rule changed: one's own bubble shows the moment one taps an answer or sends what one typed, and stays while the answer is on its way. A tap under Will's question (the way in, the plan's taps, the two setups) or on a host's join question draws its bubble at once, as the backend writes it; the backend's row takes its place when the thread is read, and a refused answer takes it away with the answers back (`own`/`withOwnBubble` in `useLoungeThread.ts`, `useSetupQuestion` in `ChatThread.tsx`). A read that lands while something is still being sent keeps it. No new words. Was: the answers went and the bubble came back only with the reply (founder 2026-11-10) · FE (this PR)
- 2026-11-10 · N626 · G0 (new), G1, G2: a Take goes to nobody unless the speaker sends it. "Record Take N" records at once with nothing sent or shared, never asks first and reuses no earlier choice; each new Take's line reads "Only me" and opens "Who hears this Take" for that Take with nobody ticked (`useRecordAlone` in `IdealTextActions.tsx`). No new words ("Only me" was signed with the sharing screen, N309). What stops: the remembered choice ("Everyone in my list" or chosen people) going with every later Take, and the screen opening before "Record Take N" · BE #1907, FE (this PR)
- 2026-11-10 · no rule changed · B8: a tap on "Did this help?" (Yes, No, Skip) shows the typing dots until Will's reply is in the thread, as a tap on Will's question and a typed answer do (`answerFeedbackCheck` in `Lounge.tsx`). Nothing new on screen. Was: nothing for a moment, then the reply (founder 2026-11-10) · FE (this PR)
- 2026-11-10 · N624 · C4: the One thing walk's fix no longer plays their confident moment again when it has its own example (the AI clip, the exercise's video): "Say this one like your confident moment:" stands right above it, in the walk and the chat (`OneExerciseBody` in `FeedbackWalk.tsx`). With no example of its own, their best stays full after the line. No new words. Was: the "Your confident moment" chip between the line and the AI clip (N379 item 1) · BE #1902, FE (this PR)
- 2026-11-10 · N623 · D4, B16: after the walk, on a plan, the plan's bar comes under the goodbye only on a day the hello did not already show it (backend `plan_flow.progress`, the plan's `hello_on`); D4 now says the goodbye and the bar as N564 left them (no "15 minutes", no "{n} of {total} practices done."). No new words. Was: the bar under the hello and again after every walk the same day · BE #1897, BE #1900, FE (this PR)
- 2026-11-10 · no rule changed · two bug fixes for §1's processing bubble: a Take whose processing screen was closed with the ✕ while it was still going up still reaches the chat (its "Your Recording" line, the bubble, then the walk), and the bubble shows at once, before the server has answered (recording-screens.md §6). Was: the Take never showed in the chat, no bubble, no walk, and "Record Take N" stayed on the Take before · FE #1364, FE #1366
- 2026-11-09 · — · §3, D4 (WILL-07): the summary row comes at once with the signed line and GPT-4o's words replace it in place; while its metadata says `writing`, Will reads it as "not in yet", never as the failed summary (`loungeScreen.ts`). No new words on screen. What stops: Will treating a summary still being written as one that failed · BE wilplus/backend-cursor#1865, FE (this PR)
- 2026-11-09 · N559 · G1: your own chats, best fit first: opened for a Take, the screen of who hears it puts first the people in your chats the matcher finds best able to answer it (`useChatOrder`, `bestFitFirst` in `NextTakeShareScreen.tsx`; `getChatOrder` in `takeMatches.ts`; BFF `/api/v2/takes/<take>/match/chats`), then the list's order; "Last sent" and the ticks unchanged, no score, no new words; a failed, slow (1.5 s) or switched-off read keeps the list's order. Before a Take nothing changes. What stops: the person sent to last always on top when the screen opens for a Take · BE N559 (wilplus/backend-cursor#1861), FE (this PR)
- 2026-11-09 · N576 · B17: a Take's bubble in Will's chat opens its words behind "Read it", one paragraph per slide, "Hide" closes them; closed by default, nothing before there are words (`ReportCard.tsx` `TakeWords`, `takeWordsOf`, with `VoiceWords` from `chats/ChatThread.tsx`). Was: only the chats with people, the inquiry and the website chat had it · BE (the Take's words on the Lounge read), FE (this PR)
- 2026-11-09 · N483, N505 · the bar where the code had drifted from the locked bar file ("The Bar, Clickable" v12, N498): the bar in a chat with a person is centred inside, 4px between, 44px tall inside, with N505's 8px above, on each side and below (was `items-end`, 16px sides, 12px above; `ChatThread.tsx`); its emoji box 42px with 40×38 buttons (was 40px, 38×38); the answers to tap 9px 16px (was 10px; `TapRow`); the Sending and Not sent pill's words #5F5F5F 500 and its Undo and Send again #121212 700 (was the text colour 400 and 600, unreadable in the dark); the recording bar's trash named "Throw it away" with the lock's trash icon (was "Delete", `trash-2`; `RecordingBar.tsx`; the walk's tests find it by that name); Will's box 42px at one line, Send 5px in from the right and the bottom (was 40px, 4px; `Lounge.tsx`). No new words on screen. What stops: the bar's frame, the emoji box, the answers, the Sending pill, the trash and Will's box each a few pixels off the locked file · BE N483, N505, FE (this PR)
- 2026-11-09 · N565 · C2, C7, K: with the `walk_voice` ring, Will also writes the line that opens the moment to try (in place of "And here's one moment to try another way:", never over the Sniper; told what the moment is walked with, the Clearer version or the AI clip), a good Take's line (in place of "The rest of this Take held up just as well.") and his reply after a try (in place of "Yes. That's it.", "Close. Once more." and "Good try. Take it with you."; told how it went, and offering one more try only when one is left). The first two are asked as the walk opens, the reply as the walk reaches it (three seconds at most after the check); the typing dots while they come, the signed lines when none come; the chat says what the walk drew (`useWalkSaid`, `afterTryRequest`, `OneTryLine`). Off the ring, nothing changes · BE N565 (wilplus/backend-cursor#1835), FE (this PR)
- 2026-11-09 · N565 · C2, K: their best is praised as how it sounded to us: "To our ears, this one sounded really sure." or "To us, this one sounded really sure.", the same for the same moment (`bestLine`; was "This was your most confident moment."). When the `walk_voice` ring reaches the speaker, Will's own written words for it stand in for that bubble and its "Why it worked", asked as the walk opens (`useBestSaid`, `askWalkVoice`, BFF `/api/v2/walk-voice`), the typing dots while they come (four seconds at most), the signed lines when none come; the chat says what the walk drew. What stops: praise that ranks the speaker ("your most confident moment") · BE N565 (wilplus/backend-cursor#1823), FE (this PR)
- 2026-11-09 · N557 · C2, K, and every line quoting them: the fix opens with "And here's one moment to try another way:" (was "And now, one thing to improve:"), and a good Take says "The rest of this Take held up just as well." (was "Nothing to fix this time.", N551), so the walk speaks of a moment to try, never of a speaker to fix (`ONE_THING_COPY.one`, `.nothingToFix`). What stops: words that told the speaker something in them was broken · BE N557, FE (this PR)
- 2026-11-09 · N555 · E1: the lesson price bar ("Artur set a price for you: a 1-on-1 lesson for …" with See times) is the web only, like the promo's: the iPhone app shows no price and no way to buy (N495; `NoticeBar.tsx` `isPriceAsk`). What stops: a price in money, and a button to the booking page and its checkout, inside the iPhone app · BE N555 (#1818), FE (this PR)
- 2026-11-09 · N551 · C2, K: a good Take (no fix, no moment below the floor) says "Nothing to fix this time." where "And now, one thing to improve:" would be, before the helper words, and the chat says it once; the coach case (N550) and a lost fix stay silent (`oneThing` in `walkPlan.ts`, `clear` on the words step, `FeedbackWalk.tsx`, `ONE_THING_COPY.nothingToFix`; backend `nothing_to_fix`). What stops: a good Take ending in a silence that reads like nothing was found · BE N551 (wilplus/backend-cursor#1819), FE (this PR)
- 2026-11-09 · N309, N359 · C0a: "Last time" names only a fix the walk opened on screen, by what it showed; a fix the speaker never saw is never named, and the Takes table shows no fix for a walk never opened (backend `take_progress.walk_gave`). No new words. What stops: "Last time" naming a fix the server chose but the speaker never met · BE wilplus/backend-cursor#1817, FE (this PR)
- 2026-11-09 · N483, N314 · the one recording bar's strip (`walk/RecordingStrip.tsx`, through `RecordingBar.tsx`) built to the locked bar file's `.rec`: a 48px grey pill, the 8px blinking dot, the mono 14px clock, a 3px #D9D9D9 track with a black fill, the 38px Stop with a white square, dot and Stop in the one red #EF4444; the chats' Sending pill is the locked `.status`, 44px; both in the locked grey #F2F2F2. No new words. What stops: the strip copied from the recording screen (rounded-2xl, 17px clock, the grey/orange/red bar, the record token's red, Stop growing on hover); the recording screen's own strip is untouched (N70) · BE N483 (wilplus/backend-cursor#1816 for context), FE (this PR)
- 2026-11-09 · N550 · C2: a walk with no fix sends the Take's least confident moment to a coach, blind, when it reads below the floor (no tool reaches it); a good Take sends nothing. The speaker sees nothing new. Stored as raised at the open, its trace naming it (`fix_without_tool`). What stops: a weak moment no tool reaches going nowhere, unseen by a coach · BE N550 (wilplus/backend-cursor#1814), FE (this PR)
- 2026-11-09 · N548 · C2: a Clearer version the walk cannot draw is no Clearer version to the walk's plan either, so the fix falls to the same moment's AI clip (`voice_too`) or to none, never to a Clearer version screen the walk then drops; the voice fix's practice opens on the picker's own clip (the Confident Voice row), not the rewrite's, so its AI clip is made on the clip that was measured (`buildFeedbackWalk`, `practiseItem` in `feedbackWalkModel.ts`). The server makes a moment the AI clip's fix only when its clip can be made (backend `_voice_problem`, wilplus/backend-cursor#1813). No new words. What stops: the fix vanishing when its Clearer version could not be drawn, and an AI clip asked for on a clip the picker did not measure · BE #1813, FE (this PR)
- 2026-11-09 · N548 · C2, K: one fix, on one moment, its tool by the kind of its weakness. The fix is the weakest (its voice shows the problem the AI clip teaches): its Clearer version first when its words need help too, else its AI clip; the moment whose words need help most is the fix only when no moment's voice shows a problem. A Clearer version the walk cannot draw gives its place to the same moment's AI clip when the server flags `voice_too`, else no fix (`oneThing` in `walkPlan.ts`, `voiceToo`). Words retired: "We don't have an exercise for exactly this yet, so here's the closest one." and "I've asked your speaking coach to make one just for you." What stops: a fix on a moment chosen for its words while a weaker voice went unfixed, the closest exercise, and an AI clip asked for a moment whose voice had nothing to teach · BE N548, FE (this PR)
- 2026-11-06 · N545 · D4: a question is the last thing; the goodbye, the plan's lines and the progress never come under Will's open question, whoever lets them go (backend `will_question.waits`, `after_take.release`). No new words. What stops: "Good job. See you {day}." and the progress under an unanswered key line · BE N545 (pushed to main), FE (this commit)
- 2026-11-06 · N544 · E2, E3: Will's key line ("… Say it the way you'll say it.") is said, not typed. While it waits the bar's middle is "Record your answer" with "Not now" under the question; the tap records in the plan's small recording bar in the bar's place, never the recording screens; Stop sends it to `/will-question/voice` (BFF route restored), heard under the processing authorization, and the thread reads again (`useKeyLineHear` in `WillVoiceAnswer.tsx`, `postWillQuestionVoice`, `Lounge.tsx`). No new words. What stops: the box "Type your answer" under the key line · BE N544 (wilplus/backend-cursor#1805), FE (this PR)
- 2026-11-06 · N547 · C2, K: a Clearer version lost on the way gives its place to the voice fix. The server serves the Take's weakest (a moment whose own voice shows a problem the AI clip teaches) as the fix, walked with its AI clip; with none, no fix, their best and its helper words (backend `_name_lost_clearer`, `fix_backup`). No new words. What stops: the closest exercise and its coach request on a lost Clearer version, whose AI clip fell back to their best's clip · BE N547 (wilplus/backend-cursor#1809, #1810), FE (this PR)
- 2026-11-06 · N546 · H1, the One thing walk's pick: a worked slide gives way unless its moment stands out, and their best and the fix spread over the talk's beginning, middle and ending, within a Take and from the last walk; on a plan the level's moment does the same; what was trained stays skipped (backend `moment_pick.praise_give`, `fix_give`, `part_of`, `take_progress.last_parts`). No new words. What stops: a clearly great or clearly poor moment on a worked slide losing to an ordinary one on an untouched slide, and the praise and the fix landing in the same part of the talk Take after Take · BE N546 (wilplus/backend-cursor#1807), FE (this PR)
- 2026-11-06 · N543 · H1, the One thing walk's pick: the moments come from untouched slides first. A slide that had helper words when the Take was recorded gives way in every slot (their best, the Clearer version's between, the AI clip's weakest, the next bests) and fills one only when no untouched slide can (backend `moment_pick._untouched_first`, `_rank`). No new words. What stops: a moment on a slide the speaker already worked on winning over an untouched slide because its own words did not hold the helper words · BE N543 (#1804), FE (this PR)
- 2026-11-06 · N541 · G3, G4: a Take sent to people is never lost silently. From a Take's line a send that fails keeps the screen open, ticked as chosen, and says "Couldn't share this take. Try again." (the community screen's toast), and Continue tries again; chosen before a Take, the send is kept on the phone under its own key (`willab.pendingTakeSends`) until it goes, tried again 5 s and 30 s later, then at the next open, signed in, once the thread has painted, within the choice's six hours, never waited on (`PeopleSendScreen` in `NextTakeShareScreen.tsx`, `applyNextTakeShare` and `retryTakeSends` in `nextTakeShare.ts`, `WillabSurface.tsx`). No new words. What stops: a failed send from the line closing the screen as if the Take had gone, and a failed send before a Take dropping the choice after one try · BE N541 (#1798), FE (this PR)
- 2026-11-06 · N537 · B16, D4: a question is the last bubble, right above its answers, everywhere; after a Take on a plan its question (the plan's own yes, the ratings, a new project's) comes under the goodbye and the plan's bar, never over them (backend `after_take.end_rows`). No new words. What stops: the plan's yes above "Good job. See you {day}." and the bar, with its buttons far below it · BE N537, FE (this PR)
- 2026-11-06 · N542 · B9, B10: a walk opened again from the chat keeps what is left to do. What was done is read only, as given; the first step not yet done (never reached, a choice not made, a practise stopped midway) stands at the bottom with its own buttons, the rest above to scroll; Close at the bottom only once nothing is left (`walkAsItStands` returns `waitsAt` in `feedbackWalkModel.ts`; `reopenedFromChat` and `review` in `useDeckFeedbackWalk.tsx`). What stops: N539's read-only scroll while something was left to do · BE N542, FE (this PR)
- 2026-11-06 · N539 · B9, B10: only the first opening of a Take's walk, right after the processing, goes step by step; every opening from the chat after it is a scroll, as given, read only, whatever still waits, with Close at the bottom; ✕ and Close on a scroll end the review as "Lesson done."'s Close does. An unseen coach word keeps its steps (`review` in `useDeckFeedbackWalk.tsx`, `coachUnseen` from `TranscriptReviewDeck.tsx`, `WalkThread.tsx`). What stops: Next on a walk reopened from the chat, and a scroll with no button at the bottom · BE N539, FE (this PR)
- 2026-11-06 · N536 · C2, K: the fix the server chose is always walked. A Clearer version that passed but did not reach the walk is the closest exercise (the voice Exercise), saying "We don't have an exercise for exactly this yet, so here's the closest one." and "I've asked your speaking coach to make one just for you." (`oneThing` in `walkPlan.ts`, `OneExerciseBody` in `walk/FeedbackWalk.tsx`, `ONE_THING_COPY.closest` and `.coachAsked`; the server names a lost one in its log, `fix_clearer_not_served`). What stops: a walk of their best and helper words with no fix while the server chose one · BE N536, FE (this PR)
- 2026-11-06 · N532 · B10, B14, C1, C9, K: "Continue review" goes from the bar. Its middle is "Record your answer" when the plan asks to hear you, else "Record Take N" (faded while a Take is processed), else "Start your first recording"; closing the walk by Close or ✕ leaves "Record Take N"; the review is reached from its Feedback walk, which keeps its outline while a step waits (`WillBarMiddle` in `plan/PlanDock.tsx`, `Lounge.tsx`). What stops: "Continue review" in the bar, and an unfinished review holding back the next Take · BE N532 (#1786), FE (this PR)
- 2026-11-06 · N309 item 4 · C, B10: a bug fix, no new rule. "Lesson done." keeps Close when the walk is opened again before the Take is finished, even with nothing of the walk left waiting (a mark the One thing walk never shows still holds the Take open), so Close writes the review's end and "Continue review" goes (`feedbackWalkModel.ts` `walkAsItStands`). Was: "Lesson done." read only, with no Close; the review's end was never written and "Continue review" stayed in the chat for good, with no way to record the next Take · FE (this PR)
- 2026-11-04 · N513 · G, J8: on the "Who hears this Take" screen Will's three bubbles are one run in the chats' rhythm, 2px apart with their corners drawn in where they meet (`data-rhythm`), then the list; the Feedback walk keeps its own 16px (J6, N469 item 2). Was: the three bubbles 16px apart, as walk bubbles · BE N513 log, FE (this PR)
- 2026-11-04 · N505 · J9: one space around every bottom bar, 8px above, on each side and below, as on WhatsApp; the thread stops 8px above the chat's bar; the walk's footer goes from 20px sides and 30px under to 8px (`globals.css` `bar-space`, `Lounge.tsx`, `LoungeLifeGoals.tsx`, `walk/WalkFooter.tsx`, `walk/WalkSheetFrame.tsx`) · BE, FE (this PR)
- 2026-11-04 · N498 item 2 · B14: Will's chat never asks for your name (it comes from sign-up); the box "Type your answer" comes only for your own words ("Something else", his follow-up with no answers, "What was missing?"); the bar's prototype is version 12 · BE N498 (#1733), FE (this PR)
- 2026-11-04 · N122, N499 · B5, B8: the walk loads with the typing dots at the bottom, where its first bubble lands, and only once it is still loading after 0.3 s (`LENS_DOTS_AFTER_MS`); a thread shorter than the screen sits at the bottom, right above the buttons, as in the chat (`IdealTextOverlay` `LensFrame`, `WalkThread`). Prototype: <https://claude.ai/artifact/1KxNrA1Yw1QDPEK1zRFBAe>. Was: the dots at the top left of an empty screen from the first frame, and the first bubbles at the top until the thread filled · BE #1738, FE (this PR)

- 2026-11-04 · N483 · B3, B10, B14, D4, E1, E3, K: the bar has one logic in every chat. In Will's chat the stack on the left, and in the middle the one thing to do now: the box "Type your answer" only when Will asks for words ("Something else", now the first of his answers, opens it; empty, it closes when you tap away); "Record your answer" for the plan's spoken questions, with "Not now" under the question; "Continue review"; else "Record Take N" for the newest Take, faded while one is processed, or "Start your first recording" before any (`WillBarMiddle`, `useWordsBox`, `Lounge.tsx`, `afterTake.ts`). What stops: the mic and voice notes to Will, the "#" note, "Keep a voice notebook?" and Will opening the notebook from your Takes (the note rests; kept notes stay, notes left on the phone still go); typing when Will has not asked; a spoken answer to Will's question; the tap "I want to continue my practice"; the ✕ beside "Record Take N"; "Continue review" above the bar; the faded "Type here" and its note · BE N483 (#1718), FE (this PR)
- 2026-11-04 · N470, N479 · G: who hears this Take: at "Record Take 2" the three signed bubbles, "Select all" and one row per person in your chats, everyone ticked or the last choice, "Last sent" on the one sent to last; Continue keeps the people and the line naming them ("Artur, Maya Lindqvist", "Everyone in my list"), and the Take is sent to each, as your message in your chat with them, once its upload is up; the line opens the screen to add people, never to unsend; asked again only when someone joins a choice of chosen people; "Record Take N" waits 1.5 s at most for the choice, then asks; nobody in the list records with nothing sent (`NextTakeShareScreen.tsx`, `nextTakeShare.ts`, `walkThread.ts`, `IdealTextActions.tsx`, `takeSends.ts`). Behind the backend's switch, off until the Privacy text is signed; off, or when its reads fail, today's screen exactly. What stops once on: General community and Only me, the crowd judging new Takes, taking a sent Take back, the passcode (N471 item 2, N479 item 4), the question asked again when a community is added. Was: G1 to G4, "How big you want your audience?" · BE N470 (#1702), N479 (#1704), BE (send PR), FE (this PR)
- 2026-11-04 · N469 · J8: the rhythm of a run, as on WhatsApp: in Will's chat and every chat with a person, two rows of the same side sit 2px apart and 12px where the side changes; anything else keeps 8px (`globals.css`, `Lounge.tsx`, `chats/ChatThread.tsx`). The walk keeps its own spacing. Was: 8px between every row · BE #1700, FE (this PR)

- 2026-11-04 · — · simplification of the N458/N459 code, no behaviour change · FE (this PR)
- 2026-11-04 · N467 · J7, E1: Will's chat starts at the bottom; every choice in a chat follows four rules: answers on your side under the question, one orange answer look with the likely one filled, "Not now", "Skip", "Cancel" and "Close" a grey word (`TapRow`), a way to go a link with › (`ChatLink`: "What would help?"'s ways, "Replace PDF", "Open exercise", "Review coach feedback", "Open speaker", a product's action, "See the feedback"); the Ideal Text failure card's two buttons are answers under it; the new project, slides and WhatsApp pairs are answers under their grey card; "Yes" last; the scale's pick orange. Was: the chat from the top, an outlined or faded "Not now", grey cards with ›, outlined buttons, buttons inside cards, black-and-grey pills · BE N467 log (#1695), FE (this PR)
- 2026-11-04 · — · C6, C7, K, T: the rules text brought in line with N338, N379, N435 and N448: no "Your turn." in the One thing walk's fix (C6, K, N379 item 3); K's "said fresh" (N123) marked as replaced by the signed words, rotating (N338 item 2); T's Skip never under the recording bar, and in the fix and the Sniper the trash is the Skip, moving the walk on (C7, T step 5 and 7, N435 item 3, N448); no rule changes · docs (this PR)
- 2026-11-04 · N371 · E1: fix: while Will's question waits, "Something else" stands alone in the bar's middle, where "Type here" stands, as N371 item 3 says; the "Type here" box underneath it is hidden (`Lounge.tsx`: the box takes `hidden` as a class, since Tailwind's `[hidden]` rule lost to its `block`). Was: both boxes stacked, "Something else" above "Type here" (founder 2026-11-04, "if it looks like this it's wrong") · FE (this PR)
- 2026-11-04 · N459 · C0a, C4, T, D4: no "When is your deadline?" after the walk, the deadline is set in the set-up before it; a slow Sniper's Last time says "Last time: keep “{words}” moving." (`ONE_THING_COPY.slowTip`, signed), a rushed one keeps "give “{words}” more room"; a weakest moment too long for the AI clip (17 s at the slow reading) is trimmed to the part around what the clip teaches (`ai_voice_prompt.fit_to_clip`), so its clip is always made, and the speaker's try asks for and is checked on the same trimmed words (`clip.passage`); the moment's own words above the clip stay whole. Was: the deadline asked above the goodbye after Take 1; the rushed tip after a slow Sniper; a moment of 37 words or more got only the tip in words · BE N459 log (#1689), BE (next PR), FE (this PR)
- 2026-11-04 · N458 · C9, D4, E1, E2, B3, B8: the chat after the walk comes however the walk ends: Close, ✕ on the finished walk, or opening a finished Take that has none yet. ✕ and the page's own open ask only when the chat's newest recording is this Take's own, so an older Take's chain never lands under a newer one; the summary is asked once per Take whichever page asks, asked again if it failed, and the chat reloads either way; a coach's late word closed with ✕ ends nothing (`askSummary`). While the summary and the chain are written the chat shows the typing dots, a tapped answer to Will too; a failed read of the chat keeps it on screen. The first Take's goodbye says it is the first Take's (`metadata.first_take`), so "Record Take 2" comes at once and records the real talk on any device. A "#" note under Will's question no longer brings his next question (`answered_first`); from Take 3 the deeper question waits until who, what and the key line are all known. Was: only the Close pill brought the chain, ✕ ended the review with nothing after it; the chat sat still with no dots for the summary's model call; the first Take's goodbye was known only on the device that started it; a note brought the next question; the deeper question came after an unanswered key line · BE #1687, FE (this PR)
- 2026-11-04 · N458 · C8, B7: another speaker's moment lands one bubble at a time; the chosen face holds 0.28 s, then the answer and "Got it." land, then the walk moves on (`WalkOverlay` `onSettled`), and the faces leave the dock once the answer shows; "Audio unclear" answers at once; their clip is asked for as the walk opens on Take 2 or later, so it is ready when the walk gets there (`prefetchOtherClips`, kept 10 minutes, under the signed link's 15). Was: the intro and the clip, then the answer and "Got it.", popped in together; the clip was asked for only on reaching the step · FE (this PR)
- 2026-11-04 · N458 · A2, B5, B7, C0, C0a: the walk opens whole behind the wait cover: it waits for the speaker's name, the last walk's fix and, when the Sniper may be the fix, the tempo answer, at most 2.5 s after its moments are there (`walkOpens`, `WALK_OPEN_WAIT_MS`); the hello and Last time are the first part's opening and land in order, the hello behind the typing dots like every grey bubble (N440 item 1); Last time's tip comes from the server (`tip` beside `last`), the chat's loaded messages only as the fallback. Was: "Hi." could change to "Hi Maya." in place and the chat kept "Hi."; Last time popped in above their best; its tip was lost once the last fix step was older than the chat's last 50 messages · BE #1687, FE (this PR)
- 2026-11-04 · N458 · C2, T, H1: the walk's Sniper is the server's choice: the frame says which one fix it kept (`one_fix` on the strongest block: "tempo", "moment" or "none"), and the walk shows the Sniper exactly then; its step waits for the stretch with the typing dots at most as long as the fix waits on its clip (`AI_CLIP_WAIT_MS`, N373), then the walk goes on, and with no Sniper to show there is no "And now, one thing to improve:": their best, their best's helper words, "Lesson done.". With no `one_fix` (older payloads), only a rushed stretch or a pace or pause week's makes the Sniper. "The fix the last walk gave" (Last time, N359, the founder's Takes table) follows the same rule (`take_progress.walk_gave`). The tempo answer is asked at once, not after the rings read, retried when it fails, and for the One thing walk comes without a topic model call; its words are the Ideal Text's smoothed words, with the stretch's slide (`slide_index`). Was: the walk guessed the Sniper from a second request that often lost the race, and then had no fix at all; a slow stretch off a pace week showed the Sniper the server had not chosen; the Takes table listed a pace fix beside every moment fix; the tempo answer waited up to 8 s on a topic the walk never says, and "um" reached the screen above its player · BE #1687, FE (this PR)
- 2026-11-04 · N458 · T, B1, B7, B10: the Sniper as the locked prototype draws it: one bubble with its line and the scale stays in its place above the tries while the walk stands on the step, the dot moving in it; each try lands, then Will's line after the dots; the chat says "And now, one thing to improve:" before the Sniper's line; the stretch's clip is in the chat (`clip:tempo`), so Will's question after the walk quotes the stretch; a Skip after a try reaches Will's note as skipped, and ✕ mid-game keeps the game for Will and says nothing (`skipped`, `left`); a walk opened from a paragraph or a step before the Sniper was played plays it live; a reopened Sniper walk shows its helper words. Was: the scale vanished after each try and its line jumped above and below; the try and Will's line landed together; Will's question quoted their best; a skip read as a game played out; a door could skip the Sniper and save its words · BE #1687, FE (this PR)
- 2026-11-04 · N458 · C4, H1: the walk's AI clip teaches the moment's strongest measured problem on a plan week too, with no runner-up, no "Lean on …" and no hold-back reordering (`ai_voice_clip._choose`, `select(hold_back=False)`); the level's problem still wins where the clip shows it. When the fix's example is a served video, the video and its instruction show at once; one server error on the clip's start no longer ends the clip; the tip in words stays when the clip never comes; a walk played again shows the fix's AI clip, or its tip in words, wherever it opens. Was: on a plan week the walk's clip could teach the runner-up or "Lean on …"; a problem not improved twice was ranked down, so the clip could teach another problem than the one its moment was picked for; dots for up to 10 s before a video; the tip could vanish; "Review feedback" drew the fix bare · BE #1687, FE (this PR)
- 2026-11-04 · N458 · C3, C5, C7, H1: the helper words the walk saves (the Clearer version's sentence, Keep mine's own, the AI clip's phrase, their best's) are saved locked, so they show under the slide in the next Take and on the Ideal Text, and in the paragraph's history; a pick on that paragraph in a later Take replaces them (`slide_helper_words.record_pick(locked=…)`). After ✕ on the recorder, "Try it" and "Keep mine" each record against the sentence they ask for (the moment's practice moves to it while it has no try, `start_practice`); the chat says "Your words it is." above the first try, never as the walk's door; Keep mine's helper words drop "So, um," but keep "Right now…", "Well over…" whole; a reopened walk after Keep mine labels each try with the speaker's own sentence; the helper words wait for the Clearer practice to open (at most 1.5 s, the typing dots) and are their best's when it never opened, shown, saved and posted alike; a between with no Clearer version is never the AI clip's fix (N381), and a walk closed during the Clearer version's try opens on it again. Was: the walk's helper words were saved unlocked and never showed on the next Take; tries were heard as "not heard" and the Clearer sentence's save refused after a switch; "now we cover three cities" under the slide · BE #1687, FE (this PR)
- 2026-11-03 · N440 · built, second part (B5, B7, B9, C3, C7): what opens a part (the walk's answer to Skip, "And now, one thing to improve:") lands first, then the step's bubbles one at a time, the AI clip's fix's too (`WalkPart` `opening`, a landing inside the fix), and its buttons last; the helper words land before the walk moves on (`WalkOverlay` `onLanded`); moving on glides; the walk's answer to Skip on the AI clip's fix shows in the walk, as the chat already said it; scrolled away, Next keeps the step's Skip under it, the step measured by its bubbles (away under 48 px in view, back at 96); with practice off Next posts nothing; a try that could not be checked keeps "Try it" and Skip; the Clearer version's sentence as helper words without its end punctuation · FE (this PR)
- 2026-11-03 · N452 · B7, C7, T, K: the chat writes no "Try it", "Keep mine" or "Skip" of the speaker's for the One thing walk's fix and the Sniper, as the walk draws none (`answerBody` null for a One thing step; `onAcceptClearer`/`onKeepWords` with a null label post nothing; the Sniper's Skip posts only "Okay, we'll skip this one."); a slow stretch's Sniper opens with one bubble, "You slowed down here. Keep it moving.", the scale in it (`tempoOpening`). Was: the chat kept the taps; a slow Sniper opened with T's three lines · BE N452 log, FE (this PR)
- 2026-11-03 · N449 · B3: after the first Take's goodbye, "Record Take 2" at once, with no "I want to continue my practice" first (`afterTake.ts`, `Lounge.tsx`); every other Take keeps the tap. Was: the tap after every Take · BE #1679, FE (this PR)
- 2026-11-03 · — · C7, T: no Skip under the recording bar, in the walk's practise and the tempo step; the trash on its left is the way out, back to the step that opened it (founder 2026-11-03, "delete that!!!! skip … for that we have the trash button on the left"; the locked prototype's `record()` draws the strip alone). Skip stays where it was before recording. Skip after "Close. Once more." now shows the speaker's "Skip" and "Okay, we'll skip this one." (N405), which it did not: the thread drew its answer only on the planned next try. Was: Skip under the bar as the walk's grey link (N314) · FE (this PR)
- 2026-11-03 · N440 · built, first part (B6, C4, J6): the chip's waveform is the prototype's 24 bars, sampled from the clip's 44, and never runs under the time (`SnippetWavePlayer` `barCount`); two of the speaker's tries in a row are round all round, as every walk bubble is (`globals.css`); the bar's ‹ › and ✕ answer a 44 px tap. Items 1, 2, 3, 5, 6 and 9 of the run-through follow on top of N435's build · FE (this PR)
- 2026-11-03 · N425 · C2, C4, H1: the walk's AI clip goes only to a moment whose own clip shows a voice problem it can teach (pace, pauses, loudness range, fillers, against the speaker's own usual on this Take), the strongest such moment, and it teaches that strongest problem, never the runner-up; with none, no AI clip and no "Lean on …" default. Was: the lowest S × W whatever its voice showed, the clip choosing what to teach, stress on the main point when nothing was measured, the runner-up about 15 times in 100 · BE N425 log (#1664), BE #1669, FE (this PR)
- 2026-11-03 · N435 · B6, B7, C3, C5, C7, T, K: the One thing walk matches its locked prototype (X4gDmGfHH7ivuoRZ9ufiy9) on seven points, from the side-by-side page <https://claude.ai/artifact/9FmH421ZiVTbA2VYH2ca3f>: no slide names inside the thread (the bar keeps them); no speaker bubble for "Try it", "Keep mine" and "Skip" in the walk (the chat keeps them); no Skip under the recording bar, its trash is the Skip, in the fix and the Sniper; "Your words it is." after "Keep mine"; those helper words without the hesitations they open with; a rushed Sniper opens with "You rushed here. Let it breathe." in the scale's bubble; the Sniper's bar names its slide; a step or bubble that draws nothing takes no room in the thread (`empty:hidden`). Was: grey names in the thread, the taps as orange bubbles, the trash back to the step that opened the recorder (the line above), N268's longer line, "So, um, …" in the helper words, three opening bubbles and "Tempo" · BE N435 log, FE (this PR)
- 2026-11-03 · N417 · E1: the sale's four steps ("Which step did it stall at?") take N371's suggested answers stacked on the right in their order, all four outlined orange and none filled (`TapRow` `even`), since no step is likelier than another; N415 item 2's "the one that goes on filled" does not apply to them. Was: four grey pills, two by two · FE (this PR)
- 2026-11-03 · N415 · Suggested answers: a lone one ("I want to continue my practice") is outlined, never filled, so it is not taken for a sent message; every ask in Will's chat (the offers' "Not now" and action, the top-up card) takes N371's suggested answers, the one that goes on filled on the right. Was: one filled orange pill; the asks as two equal pills, grey outline and black. Not changed: the consent and policy screens, "Update slides", the one-project question, the WhatsApp number's Save · FE (this PR)
- 2026-11-03 · N406 · E2, E3, K: who the talk is for, fixed from the founder's screenshot (prototype <https://claude.ai/artifact/NxE1pMJmngj8Q7ZTj9PQDp>, Option A): the goodbye waits under Will's question until it is answered, however it is answered; no "Someone else" under "Who were you talking to? 🎯", their own words go into "Something else" in the bar; Will says who from the speaker's side, "Your team. I'll keep them in mind.", and "I'll keep you in mind." for a talk to themself, then "When you finish, what do you want to do? Or feel? 🤔" with no taps, the key line keeping "your audience". No frontend code. Was: after a typed answer the goodbye came under the next question and cut it off; "Someone else" last, opening "Who is it for, then? 👀"; the words said back as typed, "Myself. I'll keep them in mind." · BE (next PR), docs (this PR)
- 2026-11-03 · N397 · B6: the walk's bar and each part's name call a slide by its title in the speaker's deck (`slideTitle` on the walk's moment, from the deck's `slideTitles`), "Slide N" when the slide has none. Was: always "Slide N" · BE N397 log (#1653), FE (this PR)
- 2026-11-03 · N405 · built (C7, T, K): Skip on the One thing walk's fix (the dock's, the recorder's, the Sniper's) gets the walk's answer under the speaker's "Skip", "Okay, we'll skip this one.", in the walk and the chat; the pace scale names its zones under it, "too slow", "just right", "too fast". Both lines signed 2026-11-03, the prototype's "Okay." and "slow · just right · fast" rewritten. Was: nothing said after Skip, and a scale without labels · FE (this PR)
- 2026-11-03 · N445 · C4: the phrase the AI clip names (its served `phrase`) is bold where it stands in the fix's own words above the clip and in the tip ("Lean on “**above ninety percent**”, like this:", or the tip in words with no clip), and in the chat's copy of the fix's words, so the speaker sees where to lean (founder, Claude Code chat 2026-11-03: "yes, bold the phrase"). Was: the words and the tip plain · BE N445 log (#1657), FE (#1192)
- 2026-11-03 · N445 · C2, C4: their best's clip and the AI clip's fix show the moment's own words above the player (its served `said`), as the locked prototype draws them (`clip(u.best.text)`, `clip(f.text)`), in the walk and the chat alike; "Last time" and their best played again inside the fix stay without words. Was: both clips drawn without words · BE N445 log (#1657), FE (#1192)
- 2026-11-03 · N395 · Record buttons; after the goodbye: the chat's one "Record Take N" stands 24 px under the last bubble (was 8) with a grey ✕ on its right, no background and no outline; the ✕ closes it and the bar comes back ("+", "Type here", the mic) for that Take, until the chat is opened again or a newer Take's goodbye offers the next. No new words. Was: alone, with no way to close it but recording · BE #1647, FE (this PR)
- 2026-11-03 · N391 · E1: notifications come in a bar at the top of the chat, never in the buttons under it: the next visit's WhatsApp ask and the CEO panel's WhatsApp, consent, promo (web only) and lesson asks, one at a time, ✕ for Not now, WhatsApp and consent opening their form as a sheet from the top; the home-screen ask is deleted everywhere. Was: WhatsApp and the home screen written in the chat at the next visit with their form in the footer (N294 item 8, N295); the CEO panel's asks the Take's one ask from Take 2, in the footer · BE (next PR), FE (this PR)
- 2026-11-03 · N309, N374 · B6, C3, C9: in the One thing walk the bar names the fix's slide again during the helper words and "Lesson done." (their best's slide with no fix, "Tempo" with the Sniper), as the locked prototype's `carry()` does (`dots(3)`; X4gDmGfHH7ivuoRZ9ufiy9). Was: the helper words had no name, so the bar kept the last one, "Other speakers" from Take 2 · FE (this PR)
- 2026-11-03 · — · T: in the One thing walk, the Sniper's Skip moves the walk on at once, after a try too, as the locked prototype's `skip()` does (founder, the Claude Code chat, 2026-11-03: "so it really matches the design and the prototype"). Was: Skip after a try closed the game on a Next · FE (this PR)
- 2026-11-03 · — · T: the tempo step's stretch is the speaker's orange clip, the sentence with the stretch marked above its player, in the walk and opened again, as the locked prototype X4gDmGfHH7ivuoRZ9ufiy9 draws it; the tempo answer carries the stretch's signed clip. Was: the words alone, no player · BE (tempo-stretch-clip), FE (this PR)
- 2026-11-03 · — · C7: the One thing walk's try is the speaker's orange clip with the words they were asked to say (the Clearer version's sentence, their own after "Keep mine", the moment's own words after the AI clip), in the walk and the chat; nothing in the thread while it records, the recording bar alone, as the locked prototype X4gDmGfHH7ivuoRZ9ufiy9 draws it. A Take served before N289 keeps "Practise N". Was: "Practise N" in place of the words and an orange "● Practise N" pill while recording · FE (this PR)
- 2026-11-03 · N381 · C2, H1: N374 item 1 withdrawn: a between whose Clearer version does not pass is praised as a next best again and left out of the One thing walk; the AI clip is the weakest's alone. Was (N374 item 1, Takes recorded from 11:00 UTC that day): that between took the AI clip when no paragraph was left for the weakest, and the clip coached the voice on a fragment whose trouble was its words. N374 item 2 (their best's own words as the helper words) is unchanged · BE (the revert of #1629), docs (this PR)
- 2026-11-03 · N380 · F1: an older version says "This is what you said in Take N." with an outlined "Go to Take M" that opens the page, and shows the helper words its slides had while it was the latest (the last set picked before the next version), orange in the words and with the HELPERS label for words it no longer says, as the page draws them; a card whose version was not kept opens the page with "Take N's words weren't saved. This is Take M." at its top (`PAST_TAKE_COPY` in `idealEditCopy.ts`, signed). Was: no line, no way to the latest, no helper words, the page opened in silence · BE N380 log and the History's helper words (BE, next PR), FE (this PR)
- 2026-11-03 · N376 · F1: which page an Ideal Text card opens is known before either is drawn, and a press on an older card starts its read (`src/lib/willab/pastIdealText.ts`); an older version shows its paragraphs slide by slide, each slide's picture and kicker on the deck that Take was said on. Was: a loader first, then sometimes the live page; plain paragraphs · BE N376 log and the History's slides (BE, next PR), FE (this PR)
- 2026-11-03 · N375 · F1: only the project's newest Ideal Text card opens the page; an older Take's card (the walk's own card or a version card) opens that Take's words as they were, read only, from the versions the History under ⋯ keeps (`IdealTextPastVersion.tsx`); a version with no saved words, or still the newest, opens the page; B10's older Take's walk now ends on that Take's card, which opens those words. Was: every card opened the live page, and the older walk ended with no card · BE N375 log, FE (this PR)
- 2026-11-03 · N374 · built (C0a, C2, C3, H1): a short Take keeps its one fix: when the between's Clearer version does not pass and no paragraph is left for the weakest (a Take of two), that moment takes the AI clip itself (8 words or more and a sound read), for Takes recorded from 3 November 2026, 11:00 UTC (backend `VOICE_FALLBACK_FROM`); and every walk leaves helper words: when the fix gives none (no fix, a tip that quotes no phrase, a stretch past eight words), their best's own words, whole, with the same line. Was: the between was praised as a next best and left out, so a new speaker's first Take showed their best alone, with no fix and no helper words · BE (the pick), FE (this PR)
- 2026-11-03 · N379 · built (C4, K): their best's clip a small "Your confident moment" chip when the fix has its own example (`WalkPlayer` `chip`); the fix's bubbles a polite live region, the AI bubble's dots and label hidden from assistive tech until its clip is ready; no "Your turn." in the fix, in the walk and the chat. Item 5 of the audit (naming the sentence for a tip with no phrase) waits on the AI voice lock · FE (this PR)
- 2026-11-03 · N377 · built (C4): the fix's no-clip words land with `walk-bubble-in`, once per wording (`FixWords`, `useLandsOnce`); "Say this one like your confident moment:" only when their best's clip follows, in the walk and the chat (`fixBest`; the chat's body now comes whole from the walk). Was: a swap with no motion, and a colon that could point at nothing · FE (this PR)
- 2026-11-03 · N373 · built (C4): the fix waits ten seconds on a clip still being made, then says its tip in words (N370's bubble), a clip that comes later joining as its player alone; once the first try began, a clip not yet seen never lands above it (`AI_CLIP_WAIT_MS`, `useClipWait`, `useClipBeforeTry`). Was: the dots as long as the clip took, and a late clip above the try · FE (this PR)
- 2026-11-03 · N370 · built (C4): the One thing walk's fix with no AI clip (its check failed, the provider or the limits refused, no voice) keeps its tip in words, the exercise's video and instruction when one is served, and "Your turn.", in the walk and the chat; "Last time" keeps the tip; the backend sends what the clip would fix with an unavailable clip once it was chosen. Was: the bubble, and the tip with it, went with the clip · BE #1621, FE (this PR)
- 2026-11-03 · N371 · E1: suggested answers, one rule for the whole app (`TapRow`): above the bar on the right, at least 44px high, 15px; the most likely last, nearest the thumb, filled orange (Will's question lists it first from the backend, so it is drawn last); two side by side, three or four stacked one per line, more than four the last three and "Show more"; a quiet "Not now" never the filled one. While Will's question waits and typing is allowed, the bar's middle is "Something else", shaped like the box, and a tap opens the box with "Type your answer"; the mic beside it answers by voice as before. Was: small outlined taps in one wrapping row, and "Type here" while Will asked · FE (this PR)
- 2026-11-02 · N359 · built (C2, H1): a fix the last walk gave (the AI clip, the Clearer version or the pace game) that worked on this Take, its issue gone on that slide by Last time's rule, is not given again on that slide; the walk picks from everything else as before, and gives it again only when the issue comes back; no walk before, or one that cannot be read, picks as before; nothing on screen, in the frame or for a coach. Was: the same fix could be given again on a slide where it had just worked · BE (this change), FE (this PR)
- 2026-11-02 · N350, N325 item 3 · C0a, H1, T, §2: mirrors the backend half: while the run waits for the verbal read the walk's read answers "pending" until the bake starts (`ideal_text_feedback_bake.hold_for_bake`, a 15-second "queued" mark set only when the run waits); the pace fix worked when every clip on that slide spends less than the bar that picks a stretch (`tempo_stretch.MIN_OUTSIDE`) of its time past the green on the stretch's side (`tempo_stretch.stays_inside`; was `tempo_stretch.furthest`), for Last time and the Takes table alike; the tempo step reaches whoever the `tempo_step` row reaches, at ring 0 everyone, and the walk's choice of the Sniper reads the row alone (`tempo_stretch.tempo_on_for`; was: also the founder reading their own Take) · BE n350, docs (this PR)
- 2026-11-02 · N350 · C0a, C7, H1, T: Stop shows in the walk's practise once its mic is live, as in the tempo step: while the mic opens, the trash and the strip alone (`useWalkPractise` `capturing`; was Stop from the moment the practise opened); the notes' verbal read waits at most 5 seconds after the Take is flipped ready and before the walk's marks are baked, so "ready" and the Ideal Text never wait and the walk may open up to 5 seconds later (was: "ready" waited for it); one rule for "the pace fix worked", every clip on that slide in the next Take inside the green on that side, the bar that picks a stretch, for Last time and the Takes table (was: any drop for the walk, a moved stretch for the table); the code simplified with the same behaviour: a Stop while the mic opens goes through the mic's generation token (`useDualCaptureMic`, no `stopEarlyRef`), the Sniper's helper words read once (`tempoWords`) · BE n350, FE (this PR)
- 2026-11-02 · N323 item 1 · §3 closed: the note under "Type here" before Take 1 is signed and built ([`the-plan.md`](the-plan.md) B10, K); a typed answer to the key line is kept as the key line, as built · docs (this PR)
- 2026-11-02 · N325 item 5 · C3, §3: the Sniper's stretch keeps the cap of eight as decided, no longer "as built"; its open question closed, "since it was last worked on" stays open · docs (this PR)
- 2026-11-02 · N314 · §4: `src/components/willab/RecordingBar.tsx`, the one recording bar, is in `scripts/design-locked-files.txt`, so a change to it needs the founder's trailer. Was: listed as not guarded · FE (this PR)
- 2026-11-02 · — · B3, D4, H1: one home per rule: a practice day's "Record Take N" points to the-plan.md G6; H1 says the notes' rules in words and names where their numbers live in the code, so the page does not drift when they are calibrated; principles.md S3 points to H1. No rule changes · docs (this PR)
- 2026-11-02 · — · §3 closed: a Stop tapped while the practise's mic is still opening (C7) is kept by the mic (`useDualCaptureMic`): the mic goes off the moment it opens, no recording starts, and an empty try goes on like any other, so the mic is never left on. Was: the Stop did nothing, the walk moved on and the mic went live a moment later · FE (this PR)
- 2026-11-02 · N347 · built (C0a, C3, D4, E2, H1, K, T, §3): Will asks "Who were you talking to? 🎯" (was "Quick one: who's this talk really for? 🎯"), its taps and "Someone else" unchanged; on a plan the goodbye says "Good job. See you tomorrow." when the next practice day is tomorrow, else "Good job. See you {weekday}." (was "Good job. See you next {day}.", tomorrow by its weekday); the pace game gets its Last time, "Last time: give “{words}” more room. You did.", with the Sniper's helper words, in the same place and under the same rule as the other fixes, risen when that slide came out slower (was: no Last time after the Sniper); and, with no code, one set of helper words per slide, the newest wins (N118), no time limit on the walk (N178's withdrawn), and H1's W as the code counts it, fillers, hedges and slide fit, "holds together" only in the hidden read; the six items closed in §3 · BE n347, FE (this PR)
- 2026-11-02 · N338 · §2: the messages line (no message at night, N189 item 1 and N193) and N123 (the asks and the walk's lines said fresh) are withdrawn, nothing like them is built, and the signed words stay; the WIL-84/86 line's follow-up is the in-place "Edited" of N192 · docs (this PR)
- 2026-11-02 · N326 · built (H1): the walk's pick and its Clearer version read what the speaker noted themselves (principles, kept strengths, life goals, Your why, # notes of the last 60 days), behind the ring row `walk_inner_context` at ring 6: one verbal read per Take, inside the processing authorization, weighs the moments for the between and gives the Clearer version a line on what matters to them; a rewrite repeating the notes' words they did not say is refused; read late or failed → the pick as before; nothing on screen changes and a coach never sees the notes or that they were used. Was: the walk never read them (N182 item 3) · BE N326 (the decision, the code), FE (this PR)
- 2026-11-02 · N323 item 6 · C, C2, T, §3: the Sniper is the One thing walk's one fix for everyone, with or without a plan, at any level, when rushing is the Take's biggest issue: the stretch ran fast and its share of time past the green is larger than 1 minus the willfidence of each moment the walk could fix (a plan's level moment included; a tie keeps the moment); on a pace or pause week as before; only for a speaker the `tempo_step` row reaches, or the founder, since without the step the walk cannot show it (backend `_sniper_first`, `tempo_stretch.tempo_on_for`). Was: only on a plan's pace or pause week, with no check that the speaker had the step · BE, FE (this PR)
- 2026-11-02 · N323 items 2 and 3 · C3, §3: the walk's own helper words are saved whole, whatever their length: their own sentence after "Keep mine", the words an AI clip's tip quotes (the paragraph's save, `source: "walk"`) and the Clearer version's sentence (`source: "passage"`); the cap of eight stays for a pick by hand on the Ideal Text and for the Sniper's stretch. A tip with no quoted phrase gives none and the walk goes on to "Lesson done." (as built). Was: none past eight words · BE, FE (this PR)
- 2026-11-02 · N314 · built (B14, C7, T): the walk's practice and the tempo step record with the one recording bar, the trash on the left, then the strip with the red Stop inside it, Skip under it as the walk's grey link; Stop sends as before; the trash throws the try away, nothing uploaded, checked or counted (the tempo game keeps nothing of it), back on the step that opened it. B3, D4: on a practice day the chat's one record button is "Record Take N" alone under the chat, not in today's one thing (N294 item 7, the-plan.md G6). Was: the practice's strip with Skip in the Back style beside a red Stop in the Finish-take style, and the tempo step's strip with Stop and no trash · FE (this PR)
- 2026-11-02 · N319 items 1 to 3 · B3, B14: before the first Take the plan's questions are asked as Will's after the walk: its choices tap answers on the right, the bar under them, its voice questions with the orange mic; "Start your first recording" only after the plan card; "Type here" faded and not focusable while the plan asks (the-plan.md B10). Was: the plan's footer in place of the bar · FE (this PR)
- 2026-11-02 · N309 · built (C, C0, C0a, C2, C3, C4, C5, C7, C8, C9, K, T): the One thing walk: "Hi {name}.", Last time when last Take's fix rose, their best with why it worked, "And now, one thing to improve:" and one fix (the Clearer version, the AI clip after their best, or the Sniper on a pace or pause week), "Try it" with Skip or Keep mine, two tries ("Yes. That's it.", "Close. Once more.", "Good try. Take it with you."), from Take 2 one moment of another speaker with its level turning across Takes, the helper words on their own, "Lesson done." and Close back to the chat. The server serves the strongest and the one fix only. Was: N289's three moments, each praise's helper-words picker, three judged moments every walk from Take 1, the tempo step on any Take, N285's lines, the summary and Next onto the Ideal Text inside the walk · BE slice4-walk (the code), FE (this PR)
- 2026-11-02 · N309 item 5 · built (G1, G2, G3): sharing is asked once, the first time "Record Take 2" is tapped; the choice is remembered, the newest line under a Take's recording carrying it (`metadata.share`, read back by `GET /v2/user/takes/share/last`), and every later "Record Take N" records at once with it, stamped on the new Take as before; asked again when the words change, a community is added or none of its communities is left; the latest Take's line opens the same screen, the choice ticked, and Continue re-shares or takes back that Take. No migration. Was: the screen before every Take from Take 2, nothing ticked, the choice kept six hours for that Take alone · BE (slice5-share), FE (this PR)
- 2026-11-02 · N314, N304, N296 state 3 · built (B14, K): every short recording in the chat records with the one bar, the trash then the walk's strip with Stop inside it; Stop sends (the voice note, an answer to Will, the life goals' words; the plan's on the-plan.md). Was: the voice note's bordered pill and black send · FE (this PR)
- 2026-11-02 · N296 state 2, N306 item 1 · built (B14): while Will's question or its follow-up waits, the same mic fills orange, colour only, for every speaker, and records the answer. Was: the mic unchanged, and only where the voice notebook is on · FE (this PR)
- 2026-11-02 · N294 items 2 and 3, N319 item 1 · built (E3): an answer to Will by voice: transcribed under the processing authorization, its words the answer, shown as the speaker's voice bubble with the words heard; the recording not kept. Was: typed or tapped only · BE, FE (this PR)
- 2026-11-02 · N294 item 2 · built (E2, E4, K): the key line in Will's chain, once who and what are known and it is missing, the plan's signed question with who in it, on the moment, no taps, answered by voice; it follows an answered "what they should do"; kept as the key line (sure) in the Take's setup, the open plan without one, and for Will. Was: not asked after the walk · BE (this PR)
- 2026-11-02 · N319 item 9 · built (B15): after an answer the chat lands on the newest bubble even when scrolled up. Was: only a new bubble moved it · FE (this PR)
- 2026-11-02 · N319 item 10 · built (A2): the wait over the walk comes from the Take's own marker, so the chat is never shown between the processing and the walk, also when the Lounge was not following that job. Was: the cover only while the Lounge followed the job · FE (this PR)
- 2026-11-02 · N294 item 1 · built (E2, K): Will's question opens on the speaker's own words of the last moment the walk showed (its clip's words): "When you said “…”, " where it reads on ("Sounds like this one's for …"), else "We just worked on “…”. "; "On purpose?" opens on nothing more. Was: the question alone · BE, FE (this PR)
- 2026-11-02 · N294 item 4 · built (E1, E2): who the talk is for, answered, is followed by what they should do when that is missing too, as Will's next question in the chain; not answering or a Skip ends them. Was: one question a Take · BE (this PR)
- 2026-11-02 · N294 item 5 · built (E2, K): Will says back who the talk is for, "{who}. I'll keep them in mind."; other answers keep "Got it, thanks 🙏". Was: "Got it, thanks 🙏" for every answer · BE (this PR)
- 2026-11-02 · N297 item 2, N319 item 8 · built (E3): the taps come from the recording first for what they should do too (the Take's words, their earlier answers, the signed ones); "Someone else" is the last tap on who the talk is for and opens "Who is it for, then? 👀". Was: no earlier answers for what they should do; "Someone else" only on the check · BE (this PR)
- 2026-11-02 · N296 item 2, N294 item 3 · built (E3, K): no grey Skip chip under Will's questions; a follow-up shows no taps; not answering is allowed and the "+" still opens the projects. Was: Skip under every question and alone under a follow-up · FE (this PR)
- 2026-11-02 · N294 items 6 and 7, N296 state 4 · built (B3, D3, D4, K): the chat after a Take ends on "Good job. See you next time." with the tap "I want to continue my practice" on the right; tapping it, or typing that they want to practise, brings "Record Take N" under the chat, alone, the plan's black button with the red dot, the message box and the mic gone; no bubble carries a button. Was: "Look, practice makes perfect. If you're ready, let's go with the next take. 💪" with "Record Take N" inside its bubble (N89) · BE, FE (this PR)
- 2026-11-02 · N319 item 7 · built (D4, K; the-plan.md E3, G13): on a plan, "That's your 15 minutes for today.", then "Good job. See you next {day}.", then Will's bubble with the plan's bar and "{n} of {total} practices done."; the walk's end sheet no longer shows the bar. Was: "Now go and live it, away from the phone." under the 15 minutes, and the bar with "{n} of {total} practices done. Next: {day}." on the end sheet · BE, FE (this PR)
- 2026-11-02 · N294 item 8, N295 · built (E1, K): WhatsApp and the home screen are never asked after a Take; the next time the speaker opens the app, one at a time, one a Take, never before the second Take, WhatsApp first ("It seems you enjoy using WillpowerLab." and its ask), the home screen last ("Well, I can see you're doing pretty good." and its ask). Was: the Take's one ask, WhatsApp from Take 1 (N171), the home screen from Take 2, with Will's lead-in · BE, FE (this PR)
- 2026-11-02 · N334 · ring 6 only (feature `chats`): when the Lounge is opened from the list of chats, it has its own top bar (back, Will's mark, "Will") in place of the WillpowerLab bar, as every chat; the Lounge itself is unchanged, and off the ring it is as it was. Was (N322 item 4): the WillpowerLab bar with "‹ Will" under it · FE (this PR)
- 2026-11-02 · N301 · built (B2, B3, B4, J2): no picture beside any bubble, the coach's included: the coach's grey-blue silhouette is gone from the Lounge (`ChatAvatar`), the walk and the coach panel (`WalkAvatar` draws nothing). Who wrote a bubble shows in its words ("Your coach:"). Was: only the coach kept a picture, on phones (founder 2026-10-14) · BE (N301 log), FE (this PR)
- 2026-10-31 · N293 · built (H1): each Take carries its context (who, what it answers, success; sure, guess or missing), from Will's answers in the talk's setup, the plan's answers and Will's "heard" read of the Take, now kept; a clip carrying the key line or the call to action counts for more as the strongest and is likelier to be the one fixed. Nothing on screen changes. Was: the pick read voice and words only, and the heard read was thrown away after Will asked · BE #1534 (the decision), BE #1535 (the code), FE (this PR)
- 2026-10-30 · N289 · built: three moments, three jobs: the strongest praised with no AI clip, then its helper words; the weakest with "Here's one with more in it.", Line A, the strongest's clip again under "Your confident moment", and the AI clip; the one between with its Clearer version, else a next best; order strongest, weakest, next, between, then the tempo step; the tempo step on any Take, with this week's pace level's line on a plan (C2, C4, H1, K, T). Was: the three highest, praise first, each praised or corrected by its voice, every praise practised with the AI clip (N108, N122, N284), and the tempo step from Take 2 (N181) · BE #1528 (the decision), BE #1529 (the code), FE (this PR)
- 2026-10-30 · N286 · built (J6): the bubbles take Messenger's shape: no tail; the open side round, the lined-up side drawn in to 6px where two bubbles of one side meet, in the Lounge (Will's split replies, his offer and top-up bubbles, the policy note and the speaker's recording included); in the walk, where every bubble stands apart, each is round all round. Was: every corner round and a small tail on a run's last bubble (2026-10-14) · BE #1525 (N286 entry), FE (this PR)
- 2026-10-30 · N285 · built (C7a, K): a line between the walk's moments, "Okay, thank you for that, let's look at your next key moment we spotted.", and one after the last, "These were some real good moments of yours, thanks for that practice – we are really moving forward.", before the tempo step or other speakers; the summary stays. Was: the next moment, or other speakers, followed the last step with nothing in between · BE (N285 log), FE (this PR)
- 2026-10-30 · N284 · built: the Take shows its three best moments, was two; a corrected moment with no exercise and no AI clip is walked as a good one, its helper words, and never skipped. Was: two moments, and such a moment left the walk (N108), so a Take could show one (founder 2026-10-30: "there is just one confident moment and the rule is that there should be at least two") (C2, C4, H1) · BE #1521 (the decision), BE #1523, FE (this PR)
- 2026-10-30 · N283 · fixed (K): the Take's highest moment's bubble says "This was your most confident moment." once; the praise lead "It was your confident moment." under it is dropped there, and any sentence that repeats an earlier one in the same bubble goes, in the walk and the chat. Was: both lines in one bubble · BE (N283 log), FE (this PR)
- 2026-10-29 · N273 · built (A4): a guest's "Done" wall carries the clip of the Take's most confident moment (the orange bubble) and "This was your most confident moment." (the grey bubble), between the line and the buttons, from the Ideal Text page and from the Lounge; read through the same owner-or-guest reads as the page, nothing new on the backend. The account stays before the walk, replacing N30's and N32 item 5's "a guest reads the whole Feedback". Was: "Done", the line and the two buttons only · BE (N273 log), FE (this PR)
- 2026-10-29 · N273 · built (B3): the empty Lounge opens with Will's hello (N270's line) as a bubble, "Start your first recording" under it and "About 2 minutes to record. Your feedback comes about a minute later." under that. Was: the button alone, and Will's hello only after the visitor typed · BE (N273 log), FE (this PR)
- 2026-10-29 · — (B5) · fixed: scrolling the walk by hand is smooth. The thread follows the newest bubble again only once a scroll by hand has come to rest at the bottom. Was: a drag up from the bottom turned following back on within its first pixels, so the thread pulled itself down under the finger, on every step (founder 2026-10-29: "I scroll through it and it stalls a little bit"). No rule changes · FE (this PR)
- 2026-10-29 · N270 · built (B3, K): a guest who accepted chats with Will; every Lounge chat turn carries their guest identity, which holds the acceptance until sign-up. Before any acceptance nothing goes to the AI: a signed-out visitor with no project gets "Hi, I'm Will. 👋 Record your first take, and I will help you with your presentation." (signed) and "Start your first recording" under it. Was: both saw "I'm having trouble reaching the lab right now. Give it another try in a moment." (founder 2026-10-29: "will the chat is very stupid at the very beginning") · BE #1499 (the decision), FE (this PR)
- 2026-10-29 · N268 · built (C5, K): after "Keep my words", "Your words it is. Now say them like you mean every one." in Line A's place there only; was Line A, "Say this one like your confident moment.", which stays everywhere else. After a Good job on a Clearer version's try, one bubble may quote the speaker's own kept words, with "Not here" the first time (the rules on [`principles.md`](principles.md) §1 R) · BE #1495 (the decision), BE (the code), FE (this PR)
- 2026-10-29 · N265 · STOP's answer is "Done. We've stopped the WhatsApp messages."; was "… and deleted your number." (N174), not true for an account that signs in with WhatsApp. Built: any other WhatsApp reply is emailed to the founder with the number, the admin page of each account at it, and its words or what kind of message it was (N171 item 6); off until `WHATSAPP_FORWARD_REPLIES` is on, after the privacy version that names the replies · BE #1493, FE (this PR)
- 2026-10-29 · — (H1, H4, §3) · written: how one clip gets its willfidence, step by step (the voice's seven cues, the fillers, hedges and slide fit, S × W and where it goes), with three worked examples, one Take, and the dark read of a moment (WIL-102); H1's "holds together" against the build goes to §3. No rule changes · FE (this PR)
- 2026-10-29 · N259 · built: a finished walk opened again is a scroll, with no buttons and no Next under it on any step. A tap on helper words brings "Edit the helper words" and "Keep these", which go again once chosen; Keep these leaves the words as saved. A walk not yet done keeps its buttons. Was: the step it stood on had its buttons, and every other step a Next (B9, B10, C3, C7, C8, C9, T) · BE #1476, FE (this PR)
- 2026-10-28 · N251 · a Take recorded in any project takes "Record Take N" from every closing message above it, and the button does not come back on them: the chat has one record button, the newest Take's, and other projects are reached through the "+" (D4). Was: N244 held only inside one project, so another project's button stayed beside the new walk, and each project's last closing message kept its own. D4 rewritten in short sentences · BE (N251 log), FE (this PR)
- 2026-10-28 · — (B5, T) · fixed: the tempo game drawn from nothing (the walk opened again further on, or its leaving copy) shows the game as the chat kept it, and every kept try has the line the dot drew (its path in the try's message); a finished walk played again shows the stretch and the lines too. Was: it showed only its opening lines, down to "🤫 Find a quiet spot first.", and a walk played again showed "Try N" without its line (founder 2026-10-28: "the sniper as a graphic does not stay there … It feels like the practice is gone from the feedback walk") · FE (this PR)
- 2026-10-28 · N245 · the tempo step (the Sniper) guides the tries: a try that lands (20 s or more from the first word, the ball four fifths in the green) gets "That landed. 🎯 Really better. Let's move on." and Next, on any try; one that came closer gets "Better. You let it breathe." and "You're close. 💪 Give it one more try."; otherwise its comment; up to three tries, then the closing line. Was: Practise again after every try, See how it went from the second, the close only after the third or on the speaker's choice (founder 2026-10-28: "If it was really better, you let me go to the next step") · BE (decisions log), FE (this PR)
- 2026-10-28 · N247 · built: a finished walk opened again shows everything the speaker went through, read only, down to the summary: the tempo step and the other speakers they judged included. Was: it stopped at the newest moment, left the tempo step out and skipped the judging (B10, C8, T) · BE #1463, FE (this PR)
- 2026-10-28 · — (B10, C3) · fixed: the Feedback walk whose newest part is helper words opens the whole walk standing on them, through the same door as every other step, once the Take's answers and tries are read. Was: it opened those helper words by themselves as soon as the page was up, before the tries were read, so words a Good job had opened (N220) were not in the walk yet and showed alone, under the hello, with nothing before or after (founder 2026-10-28: "When I click the feedback walk bubble, it just opens helper words") · FE (this PR)
- 2026-10-28 · — (B5, C8, T) · fixed: when the walk moves on, the step it leaves stays as it was: the Sniper's tries, comments and closing line (or your "Skip"), and other speakers' moments with your answers. Was: the step was redrawn empty, so the Sniper stopped at "🤫 Find a quiet spot first." and other speakers disappeared (founder 2026-10-28: "I click next and it's gone") · FE #1060
- 2026-10-28 · N246 · every Take shows two moments, a short one too; helper words picked at the first of two moments on one slide no longer hide the second; a sentence that already has its helper words gives way to the next best; on a plan, the two best and this week's level as well (C2, C3, H1). Was: a short Take showed one moment, and the second of two on one slide left the walk once helper words were picked · BE #1459, BE #1464, FE #1061
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
