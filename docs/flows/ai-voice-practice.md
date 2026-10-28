# The AI version of your voice in practice

> **Label: In force** · one of the rules, read in N95's order. Every doc and its label: [the master doc](https://github.com/wilplus/backend-cursor/blob/main/README.md) (N106).

One page for the AI version of the speaker's voice: the AI clip in the voice Exercise, its bubble in the Lounge, its card on Data & consent and the backend rules that make it. Started 2026-10-21 (backend N107) from the founder lock it replaces, backend
[`FOUNDER-LOCK-ai-voice-practice-2026-10-12.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/FOUNDER-LOCK-ai-voice-practice-2026-10-12.md), which stays as history and is no
longer edited. It works like [`feedback-walk-and-chat.md`](feedback-walk-and-chat.md): §1 is the present, a
change is a line, and the design-lock check refuses a change to a file in `scripts/flow-pages.txt` without
this page.

§1 holds the lock as it stood on 2026-10-21, word for word, so every signed word stays as it was signed. Its
amendments follow its first text, and a later amendment wins over an earlier part. Paths in §1 are in the
backend repo unless they start with `src/`. Rewriting §1 in the present tense is open (§3).

The walk's page (C6, C7, H2) says how the clip sits in the walk; where it and this page differ on the walk, the walk's page wins.

---

## 1. The rules

`LOCKED 2026-10-12 · flow yes · UI yes · words yes · backend rules yes`

Locked by the founder on 2026-10-12 (chat: "D1: Approved", "all ok, L2:
Here's how you could say it."), from two clickable prototypes:

- the walk with the AI voice: <https://claude.ai/artifact/G8Am3fR3f3SzAdTkwyUGKZ>
  (version 8), copy in `docs/design/ai-voice-practice-2026-10-12.html`;
- the Data & consent card: <https://claude.ai/artifact/1AUfoqBtZThxVbQKz1BTih>
  (version 2), copy in `docs/design/ai-voice-settings-2026-10-12.html`.

Plain-words plan with the founder's answers:
<https://claude.ai/artifact/RYMPxAqSyHinRStymsGwFr>. Decisions log N71.

It adds one step to [`FOUNDER-LOCK-moment-feedback-chat-2026-10-12.md`](https://github.com/wilplus/backend-cursor/blob/51c67077c3bb09d5a22211f55d9d122919b9983f/docs/FOUNDER-LOCK-moment-feedback-chat-2026-10-12.md)
(section 2, steps 4 and 5) and one card to the Data & consent page
([`FOUNDER-LOCK-consent-screens-2026-10-07.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/FOUNDER-LOCK-consent-screens-2026-10-07.md)). Everything else in those
locks stays as it is. Where this file and those disagree on the AI step or
the card, this file wins.

### 1. What it is

When the speaker practises the voice Exercise sentence and the try is not
yet better, the app plays **that same sentence, in an AI version of the
speaker's own voice, said a little better**, then the speaker tries again.

- **Same words.** The clip says exactly the words the speaker said in that
  sentence. Only the delivery changes: a little slower (pace), one pause
  before the target phrase (pause), or the target phrase standing out
  (stress).
- **Only the voice Exercise.** Never with praise (green moments, "Good
  job") and never with the Clearer version. Those lanes never call the
  voice provider.
- **What it trains.** The before/after of each practice feeds the future
  exercise picker. The AI clip itself is never a label and never enters a
  training set (L3).

### 2. The flow

1. **Exercise screen.**
   - The library video fits **exactly** (its main target was detected on
     this sentence) **and** targets the same problem the severity picker
     chose → the locked Exercise: the video and its instruction.
   - Otherwise → the AI clip takes the video's place: L2, the clip, L3.
2. **The try** (the locked recorder). The machine checks it (willfidence
   Δ ≥ +0.05, as locked).
   *Amended 2026-10-28 (founder, the Claude Code chat: "fix the doc wording to say voice score"): the check is on the voice score, Δ ≥ +0.05 over the original clip (`after_practice.GOOD_JOB_MARGIN`, N84), not willfidence; as built, no rule changes.*
3. **Better** → the locked "Good job". No AI clip.
4. **Not yet** → in place of the signed encouragement, one app bubble:
   - the first AI clip after a try: L4, the clip, L3;
   - every later one: L5, the clip.
   Then the locked "Practise again" and "Skip".
5. **At most 3 AI clips per exercise**, the Exercise screen's one included.
   The locked 3-try limit and the move-on line stay.

### 3. How it looks

- One grey app bubble with the grey profile picture, as every app message.
- **Audio only.** The label L1 and the one player; never the words.
- **Never plays by itself.** The speaker taps play.
- The lens and the chat show the same bubble (one thread, stored once).
- No question, no consent screen and no recording task inside the walk.
- When the clip fails its check, the provider is down, the limits are
  reached, or the AI voice is off: no bubble; the screen is the locked one.

### 4. The AI voice

- **Made from Take 1**, in the background, from its cleanest speech (about
  two minutes). Made **once** per speaker and reused; never one per
  session. If Take 1 is too short or too noisy, none is made, and the next
  Take tries again.
- **Agreed by using the app.** It is part of the Terms (L12) and the
  Privacy Policy (L13), on from the start. The founder chose this over a
  separate tick (D3a, D3b). Counsel reviews it before launch. It is built
  for every speaker and always on (founder 2026-10-12: "build it as for
  everyone", "it is always enabled"): it works whenever the ElevenLabs key
  is set; `AI_VOICE_ENABLED=0` is only an emergency off.
- **Data & consent card** (on for everyone): L6, L7, Delete (L8, confirm
  L9). Delete removes the voice at ElevenLabs and here, with every clip made
  from it, and stops new clips. Off: L10 and Turn on (L11), which makes it
  again from the next Take.

### 5. Backend rules

```
voice Exercise only     willfidence: the lowest sentence, voice weaker (S ≤ W), as locked
problem                 severity per problem (pace, pause, stress), each 0–1, against the
                        speaker's own baseline; the highest wins if ≥ 0.4, else no exercise
video or AI clip        exercise fit = exact AND main target = the chosen problem → video
when it is made         only in this lane: when Practise is tapped (video fits), or when
                        the Exercise screen opens (no video fits); one clip per exercise,
                        reused for every appearance; a clip that fails its check
                        is made ONCE MORE with a new seed, never a third time,
                        and a failed clip is simply not shown (founder
                        2026-10-21, N93; it was one generation, 2026-10-12)
what is sent            the speaker's own transcript of the sentence, with the delivery
                        controls Eleven v4 supports; no unrestricted prompt
checked before shown    decodes, not clipped, sane length and silence, the words kept
                        (re-transcribed with the existing Whisper), and the change really
                        there; failed → never shown
measured after          the next try on the chosen problem only: improved, similar,
                        worsened or inconclusive; stored, never shown
limits                  per speaker per day, per app per day, and the month's credits
                        (warning at 28,000, hard stop at 38,000 of 40,000)
```

Every provider call goes through the processing-authorization path, as
CLAUDE.md requires. Deleting the account also deletes the AI voice.

### 6. Words signed on 2026-10-12

| # | Where | Words |
|---|---|---|
| L1 | label on every AI clip | AI version of your voice |
| L2 | Exercise screen, no video fits | Here's how you could say it. |
| L3 | after L2, and after L4 | Now try saying it like that. |
| L4 | the first "not yet" | That was good. But what if you said it more like this? |
| L5 | every later "not yet" | Not yet. Listen to how you sound and how you might sound. Keep calm and try again. |
| L6 | card title | AI version of your voice |
| L7 | card, on | Made from your first Take to create your practice examples. Only you hear it. |
| L8 | card button, on | Delete |
| L9 | card confirm | Delete your AI voice? We delete it at ElevenLabs and here, with every example made from it, and we stop making examples. Your own recordings stay. |
| L10 | card, off | Off. Turn it on and we'll make it from your next Take. |
| L11 | card button, off | Turn on |
| L12 | Terms, "What the service does" (for counsel) | WillpowerLab makes an AI version of your voice from your recordings, to create practice examples that only you hear. ElevenLabs, a voice AI company, builds it for us. You can turn it off and delete it at any time in Data & consent. |
| L13 | Privacy §5, replacing "OpenAI is the only AI provider…" (for counsel) | OpenAI and ElevenLabs are the AI providers that receive your audio or your transcript: OpenAI to transcribe it and write your feedback, ElevenLabs to make the AI version of your voice. |

### Decided after the lock (2026-10-15)

- **When it is made (founder 2026-10-15, option B: "start it the moment
  you know it will be needed").** The clip no longer waits for the
  Exercise screen. The first moment the backend knows which moment carries
  the voice exercise is the end of the bake (the Manager's stored feedback
  block). Right there the practice for that moment is opened server-side,
  exactly as the walk would open it (its exercise when one is offered,
  else the moment's own words), and the clip's job starts in the bake's
  lane. The walk's own ask when the Exercise screen opens or Practise is
  tapped stays as the fallback and finds the clip already made or on its
  way. Everything else in section 5 stands: one clip per exercise, one
  generation, checked before shown, the same limits and the same permits.
- A voice still being made from Take 1 when the clip is asked for is
  waited for (a short, bounded retry) instead of waiting for the next ask.

### Decided after the lock (2026-10-16, WIL-82)

**Not only how to say it but why.** The founder (Linear WIL-82, and the
six answers in the Claude Code session of 2026-10-16): under the player,
in the same grey bubble, one sentence says what the speaker's own numbers
showed, what this version does differently and why that sounds less flat
and more engaging to the listener. It is there every time the clip
appears, on the Exercise screen and on every "not yet", in the walk and in
the Lounge chat alike; no second bubble, nothing new stored in the thread.

- **Four signed sentences**, filled in by the server from the stored
  selection: the problem the picker measured against the speaker's own
  usual delivery (pace, pause, stress), or the default when nothing reached
  the line. No model writes them; no number is in them (AC-9).
- **Every claim comes from the data.** "You said this faster than you
  usually do" is only said when the picker measured it; the default clip
  (stress on the main point, nothing measured) says "Nothing was off here"
  instead. The sentence is only sent with a clip that passed its check, so
  the change it names was really heard.
- **The speaker's target words may be quoted** (L15, L16, L17): the two to
  four words cut from their own transcript that the clip pauses before or
  makes stand out, never the whole sentence. This amends section 3, "never
  the words", by exactly that much.
- The pace sentence names no words. A clip still on its way or one that
  failed its check says nothing, as before.

| # | Where | Words |
|---|---|---|
| L14 | under the player, pace | You said this faster than you usually do. This version is a little slower. Slower gives the listener time to take each thought in, so it is easier to follow. |
| L15 | under the player, pause | You ran straight into “‹the phrase›”. This version stops for a moment before it. The pause makes the listener wait for what comes next, so it lands. |
| L16 | under the player, stress | You said this flatter than you usually do. This version makes “‹the phrase›” stand out, said a little stronger. One point that stands out gives the sentence a shape, so it is less flat and keeps the listener with you. |
| L17 | under the player, the default clip (nothing reached the line) | Nothing was off here. This version just makes “‹the phrase›” stand out a little more, so the point lands and the sentence has a shape. |

### Decided after the lock (2026-10-18, fillers)

**A fourth problem: fillers.** The founder (Linear "Evaluate retaining
filler words in transcripts", and the answers in the Claude Code session of
2026-10-18): the transcript stays clean, as locked on 2026-07-20 (the
hesitations are removed silently, the Ideal Text screen does not change).
The speaker learns about their fillers in one place, the AI clip.

- **The picker** measures fillers against the speaker's own usual delivery
  on this Take, the same way it measures pace, pause and stress: hesitations
  per 100 words above their own median (`AI_VOICE_FILLER_GAP_PER_100` more
  is the line). The hesitations are exactly the closed list the transcript
  fence removes ("um", "uh", "erm", "hmm", ...), never "like", "so" or
  "right".
- **The clip** says the speaker's own sentence with those tokens left out
  and nothing else changed. This amends section 1, "same words", by exactly
  that much: the words the clip says are the words the Ideal Text shows. The
  check hears the clip and refuses it if one hesitation is heard.
- **One signed sentence**, L18, under the player, every time the fillers
  clip appears. No number, no words quoted.
- **Measured after**: the next try on fillers only, from its own transcript
  (hesitations per 100 words, against the same line as the pick): improved,
  similar, worsened or inconclusive. Stored, never shown. The admin Take
  view shows the problem practised, the outcome and, for fillers, the rate
  before and after; that is the awareness test, read after ten speakers.
- **Uploaded Takes** have no AI voice, so they get no clip and no sentence;
  nothing else changes for them.
- Section 5's problem list reads `pace, pause, stress, fillers`; migration
  0475 widens the stored exercise accordingly.

| # | Where | Words |
|---|---|---|
| L18 | under the player, fillers | You said this with a few ums and uhs. This version says it without them. Without them each thought comes out whole, so it sounds sure and is easier to follow. |

Founder-Approved: Artur, Claude Code session 2026-10-18 ("you have my OK to
the previous one", on the task text that carried L18).

### Decided after the lock (2026-10-18, words first)

**The clearer version's voice.** The founder (Claude Code session,
2026-10-18, "ok, push to prod" on
<https://claude.ai/artifact/Ut2SqvHCoJ1hvH8dp17yQe>) amends section 1's
"Only the voice Exercise. Never ... with the Clearer version": after a
clearer-version try that is not yet better, the AI clip says the words the
speaker accepted (or their own after "Keep my words"), the same bubble, the
same lines L1 to L5 and L14 to L18, at most three per exercise. A try that
sounds better gets the Good job and no clip. The clip is asked when the
practise of the clearer words starts, never prewarmed at the bake: until the
speaker accepts, the words are not chosen. Praise still never gets a clip.

### Decided after the lock (2026-10-23, N120, the coach's voice)

**One short bubble.** The founder (Claude Code session, 2026-10-23: "as a
coach I would use here more friendly language and make it shorter focused on
one only thing without the general assessment"; "say it stronger; or lean on
this sentence"; every line signed in the chat) amends section 2's Exercise
screen and "not yet": the AI clip comes in one bubble, a one-word opener
("Nice." / "Close." / "Good."), one tip for the problem the clip fixes ending
", like this:", the clip, then "Your turn." (the Exercise screen) or "Try
again." (a try not yet better). The tip quotes the speaker's own phrase where
the problem has one. L3, L4, L5 and L14 to L18 are no longer said in the walk;
L1 stays as the clip's label. The tips, signed:

| Problem | Tips (one shown, rotating) |
|---|---|
| stress | Say “‹the phrase›” stronger · Lean on “‹the phrase›” · Push “‹the phrase›” a little more |
| pause | Pause before “‹the phrase›” · Take a breath before “‹the phrase›” · Let “‹the phrase›” wait a beat |
| pace | Slow it down a little · Take your time · A bit slower |
| fillers | Say it without the ums · Straight through, no ums · Drop the ums |
| nothing off (the default clip) | Lean on “‹the phrase›” · Give “‹the phrase›” more weight · Say “‹the phrase›” a little stronger |

The Take's most confident moment keeps its own line in place of the opener
(the walk's page, C2).

### Decided after the lock (2026-10-23, N122, confident moments)

**Praise gets a clip.** The founder (Claude Code session, 2026-10-23: "do we
practice the confident moments? I think yes we should!") amends section 1's
"Never with praise" and the 2026-10-18 "Praise still never gets a clip": a
praised moment is practised too, with the same short bubble of N120, the clip
of its own sentence a little stronger, up to three tries; a Good job ends it.
With no clip (it failed its check, the provider is down, a limit is reached,
no AI voice yet) there is no practise and the praise stands on its own. Up to
two more clips a Take, inside the same limits (section 5). The server names
the clip's problem and phrase (`problem`, `phrase`); the app picks the signed
tip.

### Decided after the lock (2026-10-23, N123, said fresh)

The bubble's opener, tip and closer are said fresh around their signed lines
(the walk's page, K, N123), checked, the signed line the fallback; the tip
always quotes the speaker's phrase where its problem has one. The clip's label
L1 "AI version of your voice" is never varied.

### Decided after the lock (2026-10-26, N188, the limits)

Each speaker gets at most 3 new clips a day and 20 a calendar month; it was
10 a day, with no monthly limit. No new voice is made while the plan's voice
slots are full, counted from the voices the app has made (Starter has 10).
Over a limit the walk shows the video or nothing, as when a clip fails, and
the Take is never held. This amends section 5's limits line; the month's
credit stop is unchanged.

### 7. Order of work

Build end to end, test with the founder's own voice, then counsel (L12,
L13, the data processing agreement with ElevenLabs, the AI Act Article 50
assessment), then launch.

Counsel approved L12 and L13 (founder, 2026-10-20, on the flow page's
first review).


## 2. In flight

One line per piece of work: `item · what it is · the rules it touches · where it stands · PR`. The session
doing it fills its line in its PR and deletes the line when the work is merged (the change goes to §6).

Nothing in flight.

## 3. Still open

- **§1 in the present tense.** §1 is the lock as written, with its amendments after it. The next change to
  this screen rewrites the part it touches in the present tense, the way the walk's page did (backend N107).

## 4. Where it lives

Frontend, guarded by `scripts/flow-pages.txt` (a change must change this page):

- `src/components/willab/LoungeAiVoiceBubble.tsx`
- `src/services/api/aiVoice.ts`
- `src/app/api/v2/user/ai-voice/route.ts`
- `src/app/api/v2/user/confidence-practice/[practiceId]/ai-voice/`

Frontend, shared (guarded by another page):

- `src/components/willab/walk/WalkAiVoice.tsx`: the clip inside the walk, guarded by the walk's page (C6)
- `src/components/account/AiVoiceCard.tsx`: the card on Data & consent, guarded by the consent page

Backend (`wilplus/backend-cursor`): the lock file this page replaces, [`docs/FOUNDER-LOCK-ai-voice-practice-2026-10-12.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/FOUNDER-LOCK-ai-voice-practice-2026-10-12.md) (history).

## 5. Prototypes

Every prototype link in §1, in the order it first appears:

- <https://claude.ai/artifact/G8Am3fR3f3SzAdTkwyUGKZ>
- <https://claude.ai/artifact/1AUfoqBtZThxVbQKz1BTih>
- <https://claude.ai/artifact/RYMPxAqSyHinRStymsGwFr>
- <https://claude.ai/artifact/Ut2SqvHCoJ1hvH8dp17yQe>

## 6. Changes

One line each, newest first: `date · N · what changed · PR`.

- 2026-10-28 · — · wording: the try is checked on its voice score (Δ ≥ +0.05, N84), not willfidence, as built and as the walk's page H1 says; no rule changes · FE (this PR)
- 2026-10-26 · N188 · the limits: 3 clips a day and 20 a month for each speaker, and no new voice while the plan's voice slots are full; was 10 a day with no monthly limit · BE #1363
- 2026-10-23 · N120, N122 · built: the clip in one short bubble (opener, tip by problem with the speaker's phrase, the clip, "Your turn." / "Try again."), the server naming the clip's `problem` and `phrase` as soon as it chooses them; a praised moment's practise gets its clip, started early by the bake like a corrected moment's · BE #1279
- 2026-10-23 · N122 · a praised moment is practised with a clip too; was "Never with praise" and "Praise still never gets a clip" · decided, build in §2
- 2026-10-23 · N120 · the AI clip comes in one short bubble, an opener, one tip ", like this:", the clip and "Your turn." or "Try again."; was L4, the clip, L3 and L14–L18 under the player, and L5 after a try · decided, build in §2
- 2026-10-21 · N107 · this page replaces backend `FOUNDER-LOCK-ai-voice-practice-2026-10-12.md` as the place the rules live; the lock stays as history · BE #1241, FE #928
