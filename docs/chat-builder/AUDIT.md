# Chat Builder audit

> **Label: Reference.** A design investigation, not a rule in force. The rules that bind the product stay in [`CLAUDE.md`](../../CLAUDE.md), the flow pages under [`docs/flows/`](../flows/), and the backend's decisions log. Nothing in this file changes a locked screen.

Written 16 November 2026 from this repo (`wilplus/frontend-cursor`, `main`) and a clone of the public backend (`wilplus/backend-cursor`, `main`). The backend was readable. The prototype the owner pointed at is copied under [`reference/`](reference/) and its lock verifier passes (14 contracts).

The owner asked for an audit of "the Speaking Coach" and of the Live/Build screen in the attached screenshot. Those are not one program. Three surfaces exist, and they share almost no configuration.

| Surface | What the person sees | Where it lives |
|---|---|---|
| The Speaking Coach loop | Record a Take, get a transcript and an Ideal Text, walk the feedback, record the next Take | Lounge, the feedback walk, recording, Ideal Text. Mostly hardcoded |
| The project chat | A project row, a Feedback Walk card, Ideal Text, one recording button | `ProjectChat.tsx`, shipped 16 November 2026. Hardcoded sample of the prototype |
| Live / Build | "Artur's chat", Live/Build, hello and orange chips | Host recipe v2, ring `chat_builder`. A chat script, not the coach |

---

## 1. The Speaking Coach loop

A speaker records a Take. The backend turns the audio into timed words, finds moments, picks one thing to practise, and writes Will's lines. The frontend lays those moments into a fixed sequence of screens. The Ideal Text is only what the speaker said on the latest Take, one paragraph per slide. A coach, if one is in the loop, judges blind and never sees the machine's guess first.

That loop is the product. The Chat Builder does not run it today.

### 1.1 Pipeline

The order below is the one the code actually implements. Names are the functions that decide.

1. **Recording and consent.** Locked screens. Frontend: `src/components/willab/LabOverlay.tsx`, `RecordingSetup.tsx`, `src/components/willab/walk/RecordingStrip.tsx`. Rules: [`docs/flows/recording-screens.md`](../flows/recording-screens.md), [`docs/flows/consent-screens.md`](../flows/consent-screens.md). Every recording goes through the processing-authorization path (`src/services/api/processingAuthorization.ts`).
2. **Transcript and blocks.** Backend turns the Take into snippets with word timings. The walk and the pace stretch both consume those timings. Entry for feedback assembly: `services/take_feedback_policy_v3.py` (`_mark_moments`, `_one_thing`) and `services/take_feedback_policy_v3_service.py`.
3. **Findings.** Detectors emit findings. The closed intervention types they must collapse into are in backend `docs/SPEC-APPENDIX-C-intervention-contract.md` (Reference): `REWRITE`, `RESTRUCTURE`, `EMPHASISE`, `DE_EMPHASISE`, `ADD`, `CUT`, `NOTICE`, `REHEARSE`. Serving, caps and the mix live in `services/intervention_candidates.py` and `services/intervention_spend.py`.
4. **Moment pick.** `services/moment_pick.py` `pick`. A moment needs at least `MIN_WORDS` (5, pinned) and a read at or above `FLOOR` (0.6, a dial). Slots: `strongest`, `weakest`, `between`, `next`. The strongest is praised. The weakest is practised with the AI clip. The between is practised with the Clearer version when the words need help.
5. **One fix.** `take_feedback_policy_v3._one_thing` keeps the strongest and exactly one fix. The choice is written on the strongest block as `one_fix`: `"tempo"`, `"moment"` or `"none"`. A word, never a score.
6. **The pace sniper.** `services/tempo_stretch.py` `pick` replays the pace scale on the Take's word timings (10 ms frames) and chooses the clip furthest outside the green. `_sniper_first` makes that stretch the one fix when rushing outweighs every moment the walk could fix, or on a pace or pause week that has a stretch, and only when the speaker has the tempo step (`tempo_on_for`).
7. **Will's words.** `services/prompts/walk_voice.py` is the system prompt. `services/walk_voice.py` `compose` / `write` asks the model for one message, then `check` refuses a number, a verdict, a third sentence, or more than 220 characters. The golden set is `tests/evals/golden/walk_voice.jsonl`.
8. **The walk on the phone.** `src/lib/willab/walkPlan.ts` `buildWalkPlan` / `oneThing` turns the server's moments into steps. `src/components/willab/walk/FeedbackWalk.tsx` draws them. `src/components/willab/useDeckFeedbackWalk.tsx` threads the chat.
9. **Ideal Text.** Separate locked screen. [`docs/flows/ideal-text.md`](../flows/ideal-text.md). The walk can end by opening it. The text is the speaker's own words, tidied, not a script the builder writes.
10. **The plan**, when the speaker has one, chooses which level this Take practises (`services/plan_walk.py`). A pace or pause week (`TEMPO_LEVELS = ("key_line", "pauses")`) is one of the ways the sniper becomes the fix. Rules: [`docs/flows/the-plan.md`](../flows/the-plan.md).

Internal numbers (willfidence, the share of time outside the green, detector certainty) stay on the server. `walk_voice` is forbidden to repeat them. `CLAUDE.md` forbids showing a score, a number or a verdict about the speaker. Two exceptions already exist and are written down: a processing-progress percentage, a token price, and a plan count such as "Practice 2 of 9". A third exception shipped on 16 November 2026 for the project-history card only (section 2).

### 1.2 The pace sniper

The founder calls the pace intervention a sniper. In the current code that name means the tempo step, not the older growth-score tables.

| Piece | Value | File |
|---|---|---|
| Rules version | `tempo-stretch-v1` | `services/tempo_stretch.py` |
| Frame | 10 ms | same, `FRAME_MS` |
| Green band | activity in `[0.275, 0.725]`, from `\|2a-1\| <= 0.45` | `GREEN_LOW`, `GREEN_HIGH`, both **pinned** in `services/noticing_settings.py` |
| How far outside counts | `MIN_OUTSIDE = 0.25` of the clip's time | dial `tempo_stretch.MIN_OUTSIDE`, notches `0.35, 0.30, 0.25, 0.20, 0.15` (catch more as the number falls) |
| Which clip | the largest share outside the green, rushed if the right side wins, else slow | `tempo_stretch.pick` |
| When it is the one fix | pace/pause week with a stretch, or a rushed stretch whose `outside` is greater than `1 - willfidence` of every fixable moment. A tie keeps the moment. No moment and a rushed stretch: the sniper is the fix | `take_feedback_policy_v3._sniper_first` |
| Who sees it | a speaker the `tempo_step` row reaches, or the founder | `tempo_stretch.tempo_on_for` |
| Topic line | a short model phrase, or "that part". The One thing walk does not say the topic | `read_topic`, `write_topic`, `FALLBACK_TOPIC` |
| The game on screen | the pace dot, tries, helper words from the stretch (1–8 words, else the best moment's words) | `WalkTempo.tsx`, `WalkTempoSaid.tsx`, `walkThread.ts` `sniperWords`, `phraseTokens.ts` `HELPER_WORDS_MAX = 8` |
| A try lands | at least 20 s from the first word, and 80% of that time in the green. The three words under the scale are the only threshold the speaker sees | `src/lib/willab/tempoStep.ts` `LAND_MIN_POINTS`, `LAND_GREEN_SHARE` |
| Who offers it on the phone | a rushed stretch, or any stretch on a pace or pause week. The server's `one_fix: "tempo"` is still what inserts the step | `useDeckFeedbackWalk.tsx` `tempoOffered` |
| Live meter while speaking | a different module, kept in step by hand with the same rise/fall constants | `src/lib/willab/pace/paceSignal.ts` `INSTANT_CONFIG` (`minGapMs` 250, `fallUpperMs` 2600, `fallLowerMs` 5000, `riseJumpMs` 400, `riseBaseMs` 1300, boosts 1.25 and 1.37) |

The One thing walk's step key is `"tempo"` with `one: true` (`walkPlan.ts`, type `WalkIntervention = "tempo"`). There is no second intervention kind in that type. Adding one today means a new key, a place in `buildWalkPlan`, and a screen.

Older tables, not the live stretch: `user_sniper_profile` and `session_sniper_metrics` (`migrations/add_user_sniper_profile.sql` and the later sniper migrations). They store words-per-minute, pause, energy and a stage score "for a growth score". The live walk does not read them to choose the stretch. A builder must not surface those numbers.

### 1.3 Moment recognition and calibration

Calibration already has a store. `services/noticing_settings.py` holds one record of named settings. Three kinds:

- **Dials**, which a host may move one notch at a time. The host-facing names are in `THINGS`: "A rushed moment", "Filler words", "Hedging", "Restarts", "Words that need a rewrite", "A voice that sounds unsure", "A moment that needs a fix", "Saying the key line".
- **Ranks**, which order moments and are not dials (`VERBAL_LIFT` 0.5, `RELEVANCE_LIFT` 0.25, `TOUCHED_GIVE` 0.2, `PART_GIVE` 0.15, `STRETCH_WORDS` 8, `NEUTRAL_SOUND` 0.5, `v4_picker.SURENESS_CUTOFF` 0.3).
- **Pinned** constants, refused if a write tries to change them. The green band is pinned because the phone's pace scale has its own copy.

The builder UI for one of these already exists, and the screen only opens filler words: Build → the walk → "What I notice" → "Too many filler words" → "Catch more" / "Catch fewer". Copy is in `src/components/willab/chats/hostsetup/hostSetupCopy.ts` (`fillerTitle`, `catchMore`, `tryTold`). The route accepts three ids, `filler_cluster`, `hedging`, and `restart_repair` (`src/services/api/hostSetup.ts` `TryThing`; backend `routes/v2/silent_tries.py`). `HostSetup.tsx` only calls `filler_cluster`. The mechanism is `services/silent_tries.py`: the new notch is scored beside the live one for 20 recordings or 14 days, coaches stay blind, and nothing a speaker sees changes until the host taps "Use it". That is the right shape for every other dial. The screen is wired for one of the three the route already allows.

Willfidence, the read the sniper compares against, is `S × W` (`services/moment_pick.py` `read`, `services/willfidence.py`). `S` is the sound score stretched to 0–1. `W` is filler, hedging, and slide-fit. The speaker never sees it. After a human coach has rated blind, the coach panel may show it as a whole percent (`docs/flows/coach-panel.md` E1). That percent is not a builder field.

Moment floor, lifts and the rewrite gate are code constants reached through `noticing_settings.value(...)`. They are not fields on the chat recipe.

### 1.4 The walk's script

`buildWalkPlan` (`src/lib/willab/walkPlan.ts`) is the script. For a Take whose moments have slots, the One thing walk is:

1. `page` (the deck, not an overlay)
2. `coachnote`, only when a coach left one
3. `praise` of the strongest, nothing to practise
4. One fix: `clearer` then `practise`, or `exVideo` then `practise`, or `tempo`. Up to two tries (`ONE_THING_TRIES = 2`). The older walk allows three (`WALK_MAX_TRIES = 3`)
5. A coach's answer on any other moment, as its own step
6. From Take 2, `others` (one moment of another speaker to judge)
7. `words` (helper words, on their own)
8. `done` ("Lesson done.")
9. `end`

A Take baked before the slot scheme still walks praise, then practice, then any `interventions` (only `"tempo"`), then `others`, then `summary`.

The prototype's walk thread (`reference/chat-continue-prototype.html`, `renderPracticeFeedbackWalk`) is one fixed sample of that shape: grey bubbles, orange audio bubbles, "Pause before …", helper words, "Lesson done.", one Next. It does not include the sniper, the Clearer version, other speakers, or the coach's note. It is a visual contract for the thread, not a second script.

The sentences the speaker reads are signed constants in `src/components/willab/idealEditCopy.ts` (`ONE_THING_COPY`, `WALK_COPY`, `WALK_LINE_BANK`, `AI_CLIP_BANK`) and `src/lib/willab/tempoStep.ts` (`TEMPO_COPY`). Examples: "You rushed here. Let it breathe.", "You slowed down here. Keep it moving.", "And here's one moment to try another way:", "These are your helper words…", "Lesson done.", "Yes. That's it.", "Close. Once more.", "Good try. Take it with you." The same lines are the flow page's section K. A new line on screen needs the founder's OK.

`POST /v2/walk-voice` can replace a signed line when the ring `walk_voice` is on (`src/services/api/walkVoice.ts`). The steps it may write are praise, the line above the fix, a good Take, and the reply after a try. It waits a few seconds and then the signed line stands. It does not replace the Sniper. The system prompt is `services/prompts/walk_voice.py`. The check in `services/walk_voice.py` refuses a number, a verdict, a third sentence, or more than 220 characters.

### 1.5 Copy, theme, assets

| Kind | Where |
|---|---|
| The lines the speaker reads | `src/components/willab/idealEditCopy.ts` (`ONE_THING_COPY` and the banks), `src/lib/willab/tempoStep.ts` `TEMPO_COPY` |
| Walk chrome | `src/components/willab/walk/*`, especially `FeedbackWalk.tsx`, `WalkMessage.tsx`, `WalkFooter.tsx`, `WalkTempo.tsx`, `WalkPractiseScreens.tsx`, `WalkOthers.tsx`, `WalkSummary.tsx`, `WalkEndSheet.tsx`. `WalkAvatar` returns null. Orange is `bg-primary` (about `#FF6A14`) |
| Thread assembly | `src/lib/willab/walkThread.ts`, `src/lib/willab/coachWalk.ts`, `src/lib/willab/coachWalkCopy.ts` |
| Coach panel copy (a human coach, not Will) | `src/lib/willab/coachPanelCopy.ts`, `src/components/willab/coachpanel/*`. Rules: [`docs/flows/coach-panel.md`](../flows/coach-panel.md) |
| Plan copy | `src/lib/willab/planCopy.ts`, `src/components/willab/plan/` |
| Orange, ink, muted | `src/app/globals.css` (`--primary`, `--foreground`, `--muted`). The prototype's `#ff6a14`, `#121212`, `#f5f5f5`, `#737373`, `#ebebeb` are the same language. Canvas max 1080px is already in `globals.css` (the lock's `shared-responsive-canvas`) |
| Pace game | `src/components/willab/pace/`, `src/lib/willab/pace/` |
| AI voice in the walk | `src/components/willab/walk/WalkAiVoice.tsx`. Rules: [`docs/flows/ai-voice-practice.md`](../flows/ai-voice-practice.md) |
| Avatar | Will is three dots (`wlp-will-mark` in the prototype). A project is a letter in a circle. The host chat uses `LetterCircle` |

The human coach panel is a different product. It is the blind queue, the Judge, exercises and the corpus. It must stay blind. It is not a screen the Chat Builder restyles in the first milestone.

### 1.6 What is already config, and what is not

Already config, per speaker or per host, not per coach definition:

- `noticing_settings` dials and silent tries
- the plan's level (`services/plan_walk.py`)
- feature rings, including `chat_builder` (`services/assistants.py` `CHAT_BUILDER`)
- whether the tempo step is on for this speaker
- the host's recipe v2 (section 3), which can name a walk of three step ids and still does not run it

Not config. Changing any of these is a code change today:

- the walk step machine and the step keys
- which intervention can be the one fix (only tempo or a moment)
- the green band and the other pinned constants
- Will's system prompt and the checks in `walk_voice.check`
- the eight intervention types
- Ideal Text generation
- recording, consent, and the coach panel
- the detectors themselves (verbal cues, rewrite gate, confidence, pace)

---

## 2. The project chat

Shipped on `main` on 16 November 2026 (`ProjectChat.tsx`, `FeedbackWalkCard.tsx`, backend `services/user_trainings.py`). [`docs/flows/feedback-walk-and-chat.md`](../flows/feedback-walk-and-chat.md) records it as founder-approved the same day: "Feedback Walk project-history prototype and handoff, 2026-11-16."

What it does:

- Opens when an existing project is picked (`WillabSurface.tsx`). Will's lounge stays the other door.
- Shows one card: presentation name (editable in the component, local state only), a Progress percentage, the latest slide-range chunk, attempts, a delivery label, and two buttons, Feedback and Ideal text. Earlier chunks expand.
- Delivery labels, weaker to stronger: "Not yet there", "Almost", "Good", "Strong delivery". Backend `_delivery_read` maps surfaced feedback families to an internal score (90, 70, 50, 25) and then to a label. Attempt count does not move the label. Whole-project Progress is the slide-weighted latest read, unpractised slides at zero. The score is not sent on the chunk; the percentage is.
- Feedback opens the existing walk. Ideal text opens the existing Ideal Text overlay (`IdealTextOverlay.tsx`, `IdealTextActions.tsx`).
- The bottom bar is Start recording or Continue recording, except while a project question is open, when chips and a text field replace it (`ProjectChat.tsx`).
- Practice length is a fixed five minutes (`src/lib/willab/practiceResume.ts` `PRACTICE_CHUNK_SECONDS`). The checkpoint stored on the phone is slide index and duration, not the walk step.

What it does not do:

- It does not read a coach definition.
- The card's edit of the title and the slide range is component state. It does not save.
- It does not run the prototype's post-walk research script ("Who were you talking to?", "Does that match what you wanted?"). It shows whatever project-tagged messages the lounge thread already has (`src/lib/willab/projectChat.ts`).
- Continue recording does not yet open the Ideal Text repeat-or-next decision before the saved-slide picker in every path. The prototype lock requires that after the post-Take questions (`project-chat-single-action`, `post-walk-project-research`). `ProjectChat.startPractice` writes a resume and calls `onRecord`.

The Progress percentage and the four delivery words are a founder-approved exception on this card. They are not a licence to put a number inside the walk or in Will's messages. `walk_voice` still refuses both.

---

## 3. Live / Build, the screen in the screenshot

The screenshot is Live mode of the host's own chat, not the Speaking Coach.

Header: back, a letter avatar, the chat's name, the subtitle "You run this chat." (`hostSetupCopy.ts` `youRunIt`), and the Live/Build switch. Body: the saved hello as one grey bubble, then the hardcoded line "Tell me what you'd like to do, and I'll show you where." (`tellMe`) whenever the recipe has taps, then orange chips. "Something else" is appended by the client even when the recipe did not store it (`WillBuild.tsx` `live`, `HostOwnChat.tsx`).

"Hi there! I'm excited to help you with your speaking skills." and the chips "tips for confidence", "how to practice", "overcoming stage fright" are **not in the repo**. They are Artur's saved recipe, returned by the backend as `own_chat.hello` and `own_chat.taps`. The speaking-coach *suggestion* in code is different (`services/chat_suggestions.py`, key `speaking coach`): hello "Hi. Record a short talk, and I'll tell you what worked.", taps such as "Practise a talk" / "Sound more sure". So the screenshot is a customised host chat that happens to be about speaking. It does not open the walk, the sniper, or Ideal Text.

### 3.1 How the switch is wired

`src/components/willab/chats/WillBuild.tsx`, shown over Will's chat for the ring `chat_builder` (`useChatsDoor.tsx`).

- The switch renders only when `can_try` is true and a recipe exists. `can_try` is false until "What do you do?" has been answered (backend comment on the read: nothing to try before that).
- Default mode is Live when there is something to try, otherwise Build.
- **Live** renders `HostOwnChat` with the recipe's hello and taps. Sending calls `POST /api/v2/chats/setup/try`. Nothing is kept. Replies come back as lines. Then "Was this useful?" (Yes / No / Skip). This is a chat dry-run. It is not a recording and not a walk.
- **Build** has two tabs. "Your chat" is Will's chat under the bar, listing the recipe's parts (`WillNeedsYou.tsx`). "AI models" is `BuildModels.tsx`. A developer-mode switch (`DevMode.tsx`) adds five further parts when the read says so.

Back goes to the chat list. With no recipe, Build opens the setup at "What do you do?" once.

### 3.2 Two recipes

Both sit on `people_profiles.chat_recipe` and both 404 without the ring `chat_builder`.

**v1**, `services/assistants.py`. Fields the host may set (`DEFINABLE`): `welcome[]`, `questions[]` (`q`, `title`, `under`, `answers[]`), `answer_with` `{tap, type, record}`, `about[]`, `fit`, `model`. Frontend type: `Recipe` in `src/services/api/assistants.ts`. The form is `AssistantBuilder.tsx`, still mounted from `ChatSetup.tsx`. Caps: 4 welcome lines, 8 questions, 6 answers. `check_host_words` refuses a score-shaped line (`\d %`, "out of", "points", "stars").

**v2**, `services/chat_recipes.py`, `V = 2`. This is the blank setup the Live/Build screen actually reads. Frontend type: `HostRecipe` in `src/services/api/hostSetup.ts`.

| Field | Meaning | Limit |
|---|---|---|
| `spec` / `what` | "What do you do?" | short specialist name |
| `name` | chat title | 40 characters |
| `line` | why people come | 160 |
| `send` | `rec`, `text`, `photo`, `file` | at least one |
| `out` | `answer`, `words`, `todo`, `mark` | one |
| `hello` | first bubble | 220 |
| `questions` | up to 3, each a `q` | 160 |
| `taps` | 1 to 3; "Something else" is refused in the stored list and added at read time | 44 each |
| `models` | up to 3. Own models: question, 2 or 3 answers, `base: gpt` only, `gives: pick` only | question 90, answer 24, line 200 |
| `who` | `shadow` (I draft, you send), `you`, `assistant` | one |
| `walk` | `{steps: subset of best, fix, words, out: ideal_text or none}` | kept, not run |
| `practice` | bool, "practice after a Take" | kept as a flag |
| `care` / `sensitive` | health, law or money forces `who = you` | |
| `live` | open to people with the link | |
| `price`, `cost`, `share` | tokens | prices 2, 1, 3 or 5 |

`welcome` and `answer_with` are derived on save so v1 readers keep working. A chat that sends a recording is treated as a skill chat; any other as a topic chat. That `fit` is not asked.

`chat_recipes.py` still says the walk is kept and that no visitor chat runs it. That comment is behind the code. `services/chat_replies.py` `make` does speak, when a walk is saved, an own model is sure, and the host has not turned that model off: the host's `says` line, word for word, then "Did this help?". That is one line in the host chat. It is not `buildWalkPlan`, not the sniper, and not Ideal Text. "I want this" (`want_walk`) still sends one mail to the founder, and the setup still says "Your chat can't run this yet" when `runs_on_messages` is false. v1 recipes refuse a `walk_order` field outright (`assistants.LOCKED`).

### 3.3 The setup conversation that exists

One decision at a time, Keep or Change, about five minutes. Copy: `hostSetupCopy.ts`. Orchestration: `src/components/willab/chats/hostsetup/HostSetup.tsx` and the rows beside it. Backend: `chat_recipes.start`, `set_part`, `read`.

The order of parts (`PART_TITLES`): What you do, Name, Why people come, They send, They get back, The feedback walk, Practice after a Take, Your hello, First questions, They can ask, Your models, Who answers.

Suggestions for a known job, including "speaking coach" and "trichologist", are the tables in `services/chat_suggestions.py`. An unknown job gets a model call that must return the same shape. The speaking-coach table is a **chat** suggestion (hello, three questions, two tap sets, four yes/no models). It is not a dump of the walk, the sniper, or the theme.

Routes, all behind the ring, frontend BFF under `src/app/api/v2/chats/` mirroring backend `routes/v2/chats.py`:

- `GET` and `PUT /v2/chats/recipe` (v1)
- `POST /v2/chats/recipe/setup`, `/setup/offer`, `/setup/answer` (Will's older setup questions)
- `GET /v2/chats/setup`, `POST /v2/chats/setup/start`, `PUT /v2/chats/setup/<part>`
- `POST /v2/chats/setup/walk/want`
- `POST /v2/chats/setup/try`
- `GET /v2/chats/<id>/host` for a visitor

A visitor in the host's chat (`HostChat.tsx`) sees the hello, the taps, and the bar that follows `send` (record, type, photo, file). Artur's own speaking chat is special-cased in places (`services/way_in.py` `SPEAKING_CHAT = "artur"`, `services/take_door.py` speaking host). A visitor of a random host does not enter the Speaking Coach loop unless that host is the speaking host and the recipe takes a recording.

### 3.4 What is poorly wired

These are gaps in the builder as it stands, not a request to fix them in this change.

1. **Live is a chat dry-run.** The screenshot cannot show a walk, a sniper, a moment, a recording, or Ideal Text. The second bubble is a fixed sentence, so two hellos stack.
2. **The speaking walk ignores the recipe.** The recipe stores three step ids and an end (`ideal_text` or `none`). "See it run" previews a sample. `buildWalkPlan` never reads it. The only runtime is the host-chat line in `chat_replies.make`, and only for a ready model's `says`.
3. **Two builders.** v1 `AssistantBuilder` and v2 `WillBuild` both write `chat_recipe`. A host can have a v1 document the v2 screen does not fully edit, and the reverse.
4. **Models cannot notice pace.** An own model may only return a pick from two or three answers, on GPT. "A score" and "an answer in your words" are refused. The sniper is not a model card.
5. **Calibration is one screen.** The silent-try route knows `filler_cluster`, `hedging`, and `restart_repair`. The Build screen only opens filler words. The other `THINGS` have no screen. Pinned settings have no screen, correctly. Ideal Text marks are a separate serving layer (`intervention_candidates.intervention_type_of`): it returns `NOTICE`, `ADD`, `EMPHASISE`, or `REWRITE`. `DE_EMPHASISE`, `CUT`, `RESTRUCTURE`, and `REHEARSE` are named in Appendix C and never returned. The sniper is not in that function.
6. **No version a Take can pin.** A recipe save overwrites. A speaker mid-walk cannot be held on the definition they started with, because there is no definition.
7. **The ring hides the whole builder.** Without `chat_builder` every setup route is 404 and the screens draw nothing. That is deliberate. It also means the Speaking Coach Artur uses as a speaker is not behind this ring and is not edited here.
8. **Copy and theme of the coach are unreachable.** Bubble radius, the orange, the walk dock, the recording strip, the letter avatar: none of them is a recipe field.
9. **Pasted code has nowhere to go.** There is no plugin table, no sandbox, and no registration step. The closest pattern is a silent try, which only moves a known dial.

---

## 4. The prototype, and where it differs from the app

Source of the interaction contracts: [`reference/chat-continue-prototype.lock.json`](reference/chat-continue-prototype.lock.json) (lock version 4, 16 November 2025 on the file's `lockedAt` of 2026-11-15). The verifier is [`reference/verify-prototype-lock.mjs`](reference/verify-prototype-lock.mjs). It checks the HTML, not the handoff and not the decision-contract page.

The handoff ([`reference/feedback-walk-handoff.md`](reference/feedback-walk-handoff.md)) describes the project-history **card**. The lock's `feedback-walk-owns-moments` describes the **thread** you get after finishing a recording (grey prompts, orange audio, no grey summary screen). Both are in the prototype. They are different screens. The app now has the card (`FeedbackWalkCard.tsx`) and the older thread (`FeedbackWalk.tsx`).

### 4.1 Locked contracts, and the app today

| Id | Contract, shortened | App today |
|---|---|---|
| `project-chat-two-results` | A practised project shows Feedback Walk and Ideal Text, and no separate recording bubble | Project chat matches. Will's lounge still has its own walk bubble and Ideal Text card |
| `project-chat-single-action` | One black button: Start recording, then Continue recording. After the post-Take questions, Continue opens the Ideal Text repeat-or-next decision before the saved-slide picker | The button exists. The Ideal Text decision is not yet that door |
| `project-chat-contextual-input` | Normally the recording button. While the project asks about the Take, chips plus an optional text composer. No voice composer, no paused card, no training-length picker | Project chat swaps in chips and a text field. The questions are the lounge's, not the prototype's three |
| `will-text-only` | Will is cross-project patterns, principles, mindset, and a text composer. No project questions and no recording button | Will's lounge still carries the plan, the day's one thing, and the road into a Take. The prototype itself still draws the plan card and "Today, one thing" inside `willChat()`, and the list preview says "AI audio is ready". The verifier forbids a recording button in Will. It does not forbid the plan card |
| `source-project-picker` | "What are you recording?" starts a project or opens one | Built (`ProjectPicker`, and the prototype's `openProjectSheet`) |
| `source-onboarding` | Whole-presentation limit: 3, 5, 10, 30, 60, Other, No time limit. Other is positive whole minutes. The limit is not the practice duration | Recording setup asks a time limit. Practice is separately capped at 5 minutes |
| `saved-slide-picker` | Saved slide, helper words, Continue from slide, Back to chat. No duration picker, no range bar | `renderPracticePicker` in the prototype matches. The app's resume stores a slide index on the phone |
| `source-recording-screen` | Slide first, helper words, a fixed five-minute clock, source back/next/finish | Recording screens are locked and already this shape. `PRACTICE_CHUNK_SECONDS` is 300 |
| `feedback-walk-owns-moments` | Finish or leave opens the single-thread walk immediately. The project card reopens it | Finish opens the walk. The card's Feedback button opens it too |
| `ideal-text-decision` | Every touched slide, visual then spoken text, top-right close, only "Continue to next fragment" and "Repeat this fragment" | Ideal Text is a locked screen of its own. The prototype's two buttons are the decision the project chat still has to grow into |
| `post-walk-project-research` | Next on the walk returns to the same project, which asks audience, intent, and whether the read matches, by taps or text. Then Continue opens Ideal Text. The last fragment returns to the project chat. Will is outside this loop | The walk's Next still follows the in-force walk (helper words, "Lesson done.", then the lounge). The three prototype questions are sample copy in the HTML |
| `no-prototype-explanations` | No "Real-code mapping", "Training paused", or similar notes on the surface | Holds in the prototype. Easy to break if a builder preview starts explaining itself |
| `public-principles-boundary` | Principles are for the open ring. Will proposes, the person accepts or edits. The swipe-down notes entry stays unavailable | Sunday note path exists (`SundayLens`, prototype `renderSundayLens`). Accept, Edit, Not now are in the prototype |
| `shared-responsive-canvas` | One centered 1080px canvas. Overlays fill it | `globals.css` |

`openForDesign` in the lock, left open on purpose: evidence-threshold tuning after testing, and the weekly reflection copy Will suggests.

### 4.2 The decision contract

[`reference/project-chat-decision-contract.html`](reference/project-chat-decision-contract.html) is an earlier binary questionnaire. Five answers are marked locked on the recommended side:

- A project inherits only its own setup and its own messages.
- While a Take processes, the person stays in the project chat and can answer questions. Processing does not block them.
- A project holds many sessions.
- The public link opens the hardcoded Will chat, and does not open a coach the builder made.
- Will may read every project and derive patterns. Each project keeps its own context.

The rest of that page is a recommendation, not a lock. Where it disagrees with the prototype lock, the prototype lock wins. The important disagreement: the decision page still talks about choosing a practice duration and about proving "choose duration" in the next prototype. The lock removed the practice-duration picker. `openPracticeTimeSheet` is still in the HTML and is not called from the picker or the recording screen. The verifier checks that. It is dead code.

The whole-presentation time limit and the five-minute practice maximum are different numbers. The prototype sets `practiceDurationSeconds = 300` when setup finishes, and stores `timeLimitMinutes` on the project.

### 4.3 Will's general insights

[`reference/will-general-insights-scope.html`](reference/will-general-insights-scope.html) is an unanswered form (role, evidence, threshold, how a principle is created, what it contains, how much project detail, cadence, an example sentence). It is not a decision. The lock already requires: Will proposes a principle, and the person accepts or edits it before it is kept. The form's "Will creates it automatically" option contradicts that lock.

### 4.4 Sample data in the prototype is not the product

`renderPracticeFeedbackWalk` hardcodes one moment ("like a diamond") and one instruction ("Pause before …"). `willChat` hardcodes a hedging pattern and the principle "State your point without weakening it first." `feedbackHistory` hardcodes five chunks and the scores 48, 57, 63, 69, 74. Those are demo fixtures. The app's card computes its percentage from surfaced feedback (`user_trainings._practice_summary`). A builder that stored the prototype's fixtures as the coach would freeze one Take.

The speaking-errors list inside the Sunday lens is a real library, and it matches the product: Rushing, Ending compression, Hedging, Word compression, Filler words, plus "Something else · Name a new error" with name, what is measured, and the single question. A new error "routes no exercise until a detector can hear it." That sentence is the plugin rule already, in the prototype's own copy.

---

## 5. Consequences for a builder

A recipe v2 document cannot name the sniper, the green band, a walk step past `best` / `fix` / `words`, a theme token, or a pasted detector. Stretching it until it can would break every host chat that already saved one, and it would still not run the walk.

The Speaking Coach is a program: a step machine, a picker, a pace replay, a prompt, and a set of screens. The Live/Build screen is a form over a chat script. The prototype is the interaction contract for a project shell around that program, plus a card the app has started to grow.

The design that follows from this audit is in [`DESIGN.md`](DESIGN.md).
