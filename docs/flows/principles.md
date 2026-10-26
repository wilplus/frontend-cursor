# The principles: the Sunday note and life goals

> **Label: In force** · one of the rules, read in N95's order. Every doc and its label: [the master doc](https://github.com/wilplus/backend-cursor/blob/main/README.md) (N106).

A reflection and cohesion tool, apart from the speaking coach: grounding,
calm, and motivation that comes from who you want to be, a principled man
or woman (backend N182). The voice notebook's # notes feed it. The Sunday
note finds a pattern in them and suggests a principle; life goals work one
goal back from the horizon to this quarter; the principles are kept in the
Life Panel.

**How this page works**

- **§1 is the present.** A rule that changes is rewritten in place; its old
  wording goes to §6 as one line. Never a new file.
- A new feature, fix or amendment is **a line in §1, §2 or §6.**
- **The prototypes are the design** (§5); this page is their written record
  and the check when something is built.
- The decisions log (backend [`docs/SPEC-DECISIONS-LOG.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/SPEC-DECISIONS-LOG.md)) keeps its
  N-numbers; an entry for this feature is two lines and a link here.
- No new words on screen without the founder's OK: every word is in §1 K.
- L and M keep the letters they had on the walk's page, where they were
  until 26 October 2026, so N158, N170 and N172 still point at the right
  rules (backend N182).

---

## 1. The rules

### A · What it is, and who has it

1. One feature: the voice notebook's # notes (backend
   [`docs/WILL-LEARNING-PLAN.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/WILL-LEARNING-PLAN.md) step 1), the Sunday note (L), life
   goals (M), and the principles in the Life Panel (`/panel/principles`)
   (N182).
2. Ring 6: the founder only, through the rings panel's rows `voice_notebook`
   and `life_goals`, until the founder widens them (N182).
3. Not the speaking coach. The Feedback walk, the plan, the coach panel and
   a Take's feedback and summary never read or show the principles, the
   Sunday note or life goals (N182).
4. Where it shows: the Sunday note and life goals in the Lounge and their
   lens; the principles in the Life Panel. Never on the recording screens,
   never shown to a coach. Private like the notebook (N158, N172, N182).
5. How it begins. The first time the person taps the mic, before the
   notebook's question, Will says why it exists in three grey bubbles: "The
   jitters before a talk are often about more than the talk. Underneath is a
   bigger question: where is my life going?" · "So we made a place for your
   answer: your goals, in your own words." · "A goal you can recall is a
   goal you can steer by. Keep yours here, and when the jitters come back
   before your next talk, we'll show you what you're doing it for." Then
   "Your notes are private. Only you and Will read them. Keep a voice
   notebook?" with Yes | Not now. Once only (N195; not built yet).

### K · Words on screen (all signed)

- **How it begins (A5, N195):** the three bubbles quoted in A5, word for
  word; then the notebook's "Your notes are private. Only you and Will read
  them. Keep a voice notebook?", "Yes", "Not now" and "Noted." (2026-10-20).

- **The Sunday note (L; approved with the lock, 2026-10-26, N158):** "We
  spotted a pattern!"; "Not now"; "Investigate"; "Sunday note"; "What one of
  those was it?"; "Add a new bug"; "Name the new bug"; "Add"; "Back"; "Did
  you have a principle in place already?"; "None yet"; "Reflections: what do
  you take from this?"; "Next"; "Skip"; "Will suggests a new principle:";
  "Accept"; "Edit"; "Add principle"; "Noted. Added to your principles.";
  "Noted."; "Close". The four 👾 bug names are the founder's own form
  (2026-10-20).
- **Life goals (M; approved with the build, 2026-10-26, N172):** every line
  quoted in M1 to M14, as drawn on the prototype (version 7); the space
  names 🏡 Personal life, 💼 Career, 🌍 The greater good; the ladder's labels
  LIFE GOAL, A WANT, HELD KNOWINGLY, GIVING UP, IN TEN YEARS, IN THREE
  YEARS, IN A YEAR, THIS QUARTER, NEXT QUARTER, TALK GOAL, THIS WEEK, "from
  your practice", "changed {date}", "Earlier:"; the field's "Say it or type
  it"; "Type instead". With N183 (M16): "📓 Use your notebook!"; "Keep the
  details in your own notebook, the paper one. Here we keep only the base.";
  with N185 (M12): the label WHEN THEY CLASH, "{space} wins", "You decide
  each time"; with N186 (M13): "The quarter ended on {date}."; with N197
  (M15): "History", "Hide history", "Set on {date}", "＋ Add a goal";
  "That's the base. Now go and live it. Come back for a short recap.". With N170: "Nothing stands out in your notes from the last
  seven days yet."; "There are no # notes from the last seven days yet."

### L · The Sunday note (backend `services/sunday_note.py`; locked 2026-10-26, N158)

The prototype is the design: <https://claude.ai/artifact/Bt2YEZLKhu9fLTA1deWTvo> (§5). Built 2026-10-26: the lens is `SundayLens.tsx`, every question and answer a row of the one thread written by the backend (`/v2/notebook/sunday/<id>`, `/answer`).

- **L1** On Sunday by itself, and whenever asked (N170). On Sunday from 6 pm
  in the speaker's time zone, once, Will brings L2 by itself when the last
  seven days of # notes show a pattern; with none, nothing is sent, and not
  when a case was already shown in those seven days. Never on another day
  by itself. Asked on any day, in any words: Will goes by the meaning ("do
  you see a pattern?", "what keeps tripping me up?", "sunday note",
  "#sunday"), not by set phrases. The
  case comes only from the # notes of the last seven days, not the calendar
  week, so asking on a Monday still reads Thursday and Saturday (N170) (the
  voice notebook's small mic and typed "#" notes); the talk goal and the
  principles held are context, never evidence; Takes, the Lounge thread and
  Will's note on the speaker never reach it. With nothing to find, Will says
  so in one grey bubble and never invents a case (N170): "Nothing stands out
  in your notes from the last seven days yet."; with no # note in those
  seven days, "There are no # notes from the last seven days yet." The
  message box stays; on Sunday, by itself, it never says this (founder
  2026-10-26: "Takes are separate from this"; N170 on
  <https://claude.ai/artifact/M5GWxvbNPRbkEjoL2ivZxB>, then "keep it
  sunday", which replaced N158's "If not asked, no answer from Will").
- **L2** In the Lounge: two grey bubbles in the chat's font, "We spotted a
  pattern!" and the case in one sentence. The message box gives way to
  Not now | Investigate (`SymmetricPair`, as the WhatsApp ask); answered,
  the box comes back. Not now lands as the speaker's bubble, then "Noted.".
- **L3** Investigate opens the lens (B2): full screen, the bar "‹ Sunday
  note ›" and ✕, the thread growing by taps (B5, B7), no message box. The
  case is never shown twice.
- **L4** "What one of those was it?": the dock holds 👾 Too much pleasure,
  👾 Blind spots, 👾 Hubris and 👾 Wishful thinking as the judgement's tall
  full-width answers (C8), then "Add a new bug" with a + on the right, which
  opens a field ("Name the new bug", Add, Back). A chosen answer fills
  black, holds 0.28 s and lands as the speaker's orange bubble (J5).
- **L5** "Did you have a principle in place already?": only the two held
  principles most likely to apply (⚜️), then "None yet". No "why" question.
- **L6** "Reflections: what do you take from this?": a field, Next once
  there are words, and Skip. Will never writes the reflection.
- **L7** "Will suggests a new principle:", then "⚜️ {principle}" in its own
  bubble. The dock: Accept (black), Edit (outline), Not now (link). Edit
  opens a field with the words, Add principle and Back. Accept or Add
  principle puts it among the active Life Panel principles (propose, never
  commit), and the reply is "Noted. Added to your principles."; Not now,
  "Noted.". Then Close.
- **L8** One thread (B1): the lens and the Lounge show the same rows. The
  "We spotted a pattern!" bubble carries › and the orange outline while it
  waits, and opens the lens again where it stands (B10). Old | New is gone
  (founder 2026-10-26: the user could not tell what it asked); a case
  written before still answers it.

### M · Life goals (backend `services/life_goals.py`; decided 2026-10-26, N172)

The prototype is the design: <https://claude.ai/artifact/HaWehtwfg1jzJvGeGM1c24> (§5, version 7). Founder only (ring 6, `life_goals`), in the Lounge and its lens; never on the recording screens, never shown to a coach. Private like the notebook. No number about the speaker (Never 1): horizons and dates are the speaker's own.

- **M1** When it is asked. Once, right after the first # note's "Noted."
  (voice or typed): two grey bubbles, "One more thing: your life goals." and
  "One goal today. Say or type your answers.", with Not now | Start in
  place of the message box (as L2). Not now lands as the speaker's bubble,
  then "Noted."; Will asks once more after the next # note; a second Not now
  and it waits for the speaker to ask.
- **M2** Asked in the speaker's own words, any day ("#goals", "can I add
  another goal?", "I want a goal for my health"): Will goes by the meaning;
  "Of course, you can add a new goal anytime. Let's do it." and the lens
  opens by itself, because they asked. "#goals" with goals kept opens the
  ladders (M10): "Your goals." and the spaces in one line.
- **M3** The lens (L3's frame, the bar "‹ Life goals ›"), one goal per
  sitting. "Which matters most right now?": 🏡 Personal life, 💼 Career, 🌍
  The greater good as tall answers (L4's), each marked "· has a goal" when
  it holds one. A space may hold more than one goal; a space with a goal
  shows it ("{space} already has a goal:") and asks "Keep both, or let the
  new one replace it?" (Keep both · Replace it; the old one stays in its
  history). When the ask named what they want, Will places it first: "That
  sounds like {space}." (Yes, {space} · Another space).
- **M4** Three open questions, said with the small mic or typed, each with
  Skip: "What do you truly want most {in your career}?", "What will
  actually fulfil you?", "What fits your nature and strengths?". When the
  ask already said what they want, Will quotes it instead of the first:
  "You said: “…”". All three skipped: "I have nothing of yours to draft
  from yet. Let's do this another time." and Close; Will never invents a
  goal.
- **M5** Will's draft, only from their words, quoting them: "Will's draft,
  from your words:", the goal, "From: “…” · “…”". Accept · Edit (a field
  with the words, "Keep this goal").
- **M6** "Is this what you want in the long run, or something you want
  now?" (🎯 The long run · ⏳ Something I want now). A want: "What would
  having it give you?", then "Then the goal may be under it:", the redraft
  quoting the answer, and "“{want}” stays beside it, as a want you hold
  knowingly." Accept · Edit.
- **M7** "Is it ambitious enough?" (🚀 Yes · ⬆️ Not yet). Not yet: "Make it
  bigger:" and a field with the goal, "Keep this goal".
- **M8** "What will you give up for it?" Said or typed, or Skip.
- **M9** "By when?" (🌱 1 year · 🌿 3 years · 🌳 10 years · ♾️ A lifetime),
  a date on the ladder. Will works back one step per screen, each aimed at
  the step above: 3 years asks the year ("For it to be true by {date}, where
  must it be by {date}?"); 10 years asks three years, then the year; a
  lifetime asks ten years ("It's a lifetime goal. Where must it be by
  {date}?"), then the year; 1 year asks none. Then the quarter: "Then what
  must be true by {quarter's last day}, {n} weeks from now, to be on track
  for “{step}”?" (without a step above: "What must be true by …?"). With
  less than four weeks left in the quarter, "This quarter is nearly over, so
  let's aim at the next one." and the next quarter's last day.
- **M10** The ladder, one bubble per goal: the space, then LIFE GOAL · by
  {date}, A WANT, HELD KNOWINGLY, GIVING UP, IN TEN YEARS, IN THREE YEARS,
  IN A YEAR (each · by {date}), THIS QUARTER or NEXT QUARTER · by {date};
  under the goal the talk serves (career unless the speaker moves it), TALK
  GOAL and THIS WEEK · from your practice; then WHEN THEY CLASH, one row per
  goal it clashes with (M12). A skipped step is left out. Then
  "Noted. Your {space} goal is set." and Close; the Lounge keeps the thread
  and the bubble opens the lens again (L8).
- **M11** Changing a step: "#goals" or the › on a ladder bubble opens "Tap
  the step that is wrong." and the ladder, each step a row with ›; This week
  has none (it comes from the practice). A tap: "Now: {step}", "What should
  it say?", a field, "Keep the change", Back. The talk goal says first "This
  is your setup answer too. Changing it here changes it there." and changes
  it there. A changed step asks once about the next one down: "Does “…”
  still get you there?" (✅ Yes, it still fits · ✏️ Change it too). Then
  "Noted. Changed on {date}." and the ladder with "· changed {date}" and
  "Earlier: …". Done; "All still right" leaves it. Every version is kept,
  dated.
- **M12** A second goal whose give-up pulls against another goal (N185):
  before the new goal is set, Will checks once per pair, from their words
  only, names both in one bubble and asks "When they clash, which wins?"
  ({emoji} {space} · {emoji} {space} · ⚖️ I decide each time; when both
  goals share a space, each is named by its first words); "Noted. On both
  ladders: when they clash, {space} wins." (or "you decide each time.").
  Both ladders get the step WHEN THEY CLASH: "{emoji} {space} wins" or "You
  decide each time". It changes by tapping, like any step (M11), with the
  same three answers; the earlier answer is kept with its date.
- **M13** The quarter comes back on its last day, once per goal with a
  quarter step, in the Lounge: "The quarter ends today." and "{emoji} {step}.
  Did it move?" with Not now | Start. No clock (N186): they are waiting the
  first time the Lounge opens that day; opened later, "The quarter ended on
  {date}." in place of the first. The lens: the ladder, "Did it move?"
  (🎯 It got there · ↗️ It moved · ⏸️ It stalled), never a score; moved or
  stalled: "What got in the way?", then, only when some match, "Your notes
  said it too:" and their own # notes quoted with their dates; "What would
  move it forward by {next quarter's last day}?"; the ladder; "Noted.".
- **M14** A # note that sounds like a change: Will asks once in the Lounge,
  quoting it: "Change {emoji} this quarter to “…”?" and "Now: …. From your
  note: “…”", Not now | Change; Change: "Noted. {emoji} This quarter is now
  “…”. “…” stays in its history." and the ladder. Never a change by itself.
  The new words and the quote are found word for word in the note, else
  nothing is asked; asked once per note; only the quarter step, "this
  quarter only is fine" (N191;
  prototype version 9, scene 5).
- **M15** Kept in the Life Panel's store as its top layer, above the three
  bets; every version dated. Will reads the ladders and their dated changes
  before it chats and before the Sunday note. On the Goals screen (N197,
  prototype <https://claude.ai/artifact/BeKgTGi1KXvF5ruvMEiA33>): "Life
  goals" above "Three bets, in order.", one ladder per set goal, each step a
  row with › that opens the lens over the panel on that step; under each
  ladder "Set on {date}" and History / Hide history, every version newest
  first with its date and the quarter's answers in words; under the ladders
  "＋ Add a goal". Before the first goal, nothing new.
- **M16** The base, not the details (backend N180, N183). The first time the
  lens opens (no goal yet, no draft), before the space: "📓 Use your
  notebook!" and "Keep the details in your own notebook, the paper one. Here
  we keep only the base." When a goal is set, after "Noted. Your … goal is
  set.": "That's the base. Now go and live it. Come back for a short recap."
  (in the lens and in the Lounge). The voice notebook stays for short #
  notes for Will; the long personal writing goes in the paper notebook.

---

## 2. In flight

One line per piece of work: `item · what it is · the rules it touches ·
where it stands · PR`. The session doing it fills its line in its PR and
deletes the line when the work is merged (the change goes to §6).

- **N172** · life goals (M) · M · M1–M15 built (M15 with N197: backend #1373, FE this PR); then this week's focus on the ladder (no source yet) · BE #1335, FE (this PR)

## 3. Still open

- Who gets it beyond the founder: the founder widens the `voice_notebook`
  and `life_goals` rings (N182).

## 4. Where it lives

- The voice notebook: backend `services/voice_notebook.py`,
  `routes/v2/voice_notebook.py`; frontend `src/components/willab/useVoiceNote*`,
  `src/services/api/voiceNotebook.ts`, `src/app/api/v2/notebook/`.
- The Sunday note: backend `services/sunday_note.py`; frontend
  `src/app/api/v2/notebook/sunday/`.
- Life goals: backend `services/life_goals.py`, `routes/v2/life_goals.py`;
  frontend `src/components/willab/LoungeLifeGoals.tsx`,
  `src/lib/willab/lifeGoals.ts`, `src/services/api/lifeGoals.ts`,
  `src/app/api/v2/life-goals/`.
- The principles: frontend `src/app/panel/principles/`, in the Life Panel
  ([`docs/life-panel-spec.md`](../life-panel-spec.md)).
- How Will learns from all of it: backend
  [`docs/WILL-LEARNING-PLAN.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/WILL-LEARNING-PLAN.md).

## 5. Prototypes

- The Sunday note as a lens <https://claude.ai/artifact/Bt2YEZLKhu9fLTA1deWTvo>
  (N158, 2026-10-26); asking for it
  <https://claude.ai/artifact/M5GWxvbNPRbkEjoL2ivZxB> (N170, 2026-10-26).
- Life goals <https://claude.ai/artifact/HaWehtwfg1jzJvGeGM1c24> (N172,
  version 7, 2026-10-26; version 9 adds scene 5 as built for M14, N191).

## 6. Changes

One line each, newest first: `date · N · what changed · PR`.

- 2026-10-26 · N158, N170 · built (L): the Sunday note as a lens; only the # notes of the last seven days; on Sunday from 6 pm by itself only when they show a pattern, and whenever asked in any words; "We spotted a pattern!" and the case with Not now | Investigate; the lens asks the bug, the principle held, the reflection and Will's new principle (Accept, Edit, Not now); the bubble's › reopens it where it stands. What stopped: the long case form, Old | New and its "Add principle" footer · BE #1382, FE (this PR)
- 2026-10-26 · N197 · built (M15): the ladders on the Life Panel's Goals screen, above the three bets; a tapped step opens the lens over the panel on that step; History lists every version, dated; "＋ Add a goal"; nothing before the first goal (`LifeGoalsLadders.tsx`) · BE #1371, #1373, FE (this PR)
- 2026-10-26 · N195 · A5: the first tap on the mic, before the notebook's question, says why it exists in three bubbles (the jitters, a place for your goals, a goal you can steer by); was: the question alone · BE #1369, FE #1008
- 2026-10-26 · N191 · built (M14): under a # note's "Noted.", a note that says a goal's quarter step should be different is asked about once, quoting it, the new words only from the note; Change writes it with the earlier words kept and shows the ladder, Not now changes nothing · BE #1359, #1361, FE (this PR)
- 2026-10-26 · N186 · built (M13): no clock; the first time the Lounge opens on the quarter's last day (or later, "The quarter ended on {date}."), "Did it move?" with Not now | Start; the lens asks how it went in words, what got in the way, quotes their own notes only when some match, and sets the next quarter's step with the earlier one kept · BE #1354, #1356, FE (this PR)
- 2026-10-26 · N185 · built (M12): before a new goal is set, Will checks once per pair whether it pulls against a kept goal, from their words only, and asks "When they clash, which wins?"; the answer is the step WHEN THEY CLASH on both ladders, changed by tapping with the earlier answer kept · BE #1351, #1353, FE (this PR)
- 2026-10-26 · N180, N183 · built (M16): "📓 Use your notebook!" and the paper-notebook line the first time the lens opens; "That's the base. Now go and live it. Come back for a short recap." when a goal is set; the voice notebook stays for short # notes · BE (this change), FE (this PR)
- 2026-10-26 · N182 · this page: the principles, the Sunday note and life goals are their own feature, ring 6, apart from the speaking coach; L and M moved here from the walk's page with their letters, words, in-flight lines and prototypes · BE #1344, FE #993
- 2026-10-26 · N172 · built (M1–M11): the ask after a # note with Not now | Start; "#goals" or an ask in your own words opens the lens; one goal per sitting, the open questions said with the small mic or typed, Will's draft quoting only your words, goal or want, ambitious, give up, the horizon worked back to the quarter with the four-week rule, the ladder in the Lounge with its ›, a step changed with its earlier words kept; the lens is the walk's frame (`LoungeLifeGoals.tsx`); the pair shows above the message box, as the notebook's and the WhatsApp ask's do · BE #1335, FE (this PR)
- 2026-10-26 · N172 · life goals decided (M): asked once after the first # note and once more after the next, or whenever asked; one goal per sitting in a lens; drafted only from the speaker's words; goal or want; a horizon and the steps worked back to the quarter, with the four-week rule; the ladder; changing a step with its history; kept in the Life Panel · —
- 2026-10-26 · N170 · the Sunday note (L1): on Sunday from 6 pm by itself when the last seven days of # notes show a pattern, and whenever asked, in any wording, understood by meaning; asked with nothing to find, one line saying so; was only when asked, by "sunday note", "#sunday" or "case of the week", read from the calendar week, with Will answering as usual when there was nothing · —
- 2026-10-26 · N158 · the Sunday note locked as a lens (L): only when asked, only from # notes, two bubbles and Not now | Investigate in the Lounge, the bug, the principle, the reflection and the new principle one step at a time in the lens, Accept or Edit; was the whole form in one bubble every Sunday at 6 pm, read from the Takes and the chat, with Old | New · —
