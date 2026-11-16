# Chat Builder design

> **Label: Reference.** A proposal. It is not in force. It does not change a locked screen, a flow page, or the backend decisions log. Implementing any of it is a later change, and that change has to edit the flow page it touches and carry `Founder-Approved:` where the lock check requires it.

The audit is [`AUDIT.md`](AUDIT.md). The prototype and its lock are in [`reference/`](reference/). The lock verifier passes against those copies.

The milestone the owner asked for: using only the Chat Builder, he can reproduce today's Speaking Coach, inch by inch, including the design. A later milestone, designed here and not built: another expert builds a coach for their own skill the same way.

---

## 1. Decisions made for this design

These are calls made so the spec has one shape. Each one that the owner may still want to overturn is also an open question in section 10, with this call as the recommended default.

1. **The coach is a document, not a bigger recipe.** Recipe v2 (`services/chat_recipes.py`) stays the host-chat script. A new document, `CoachDefinition`, is what the speaking runtime reads. The host chat can point at a coach. It does not become one.
2. **One seed, generated, not hand-copied.** The first document is `speaking-coach`, produced by a script that reads the constants and step list the app already uses. Parity is a diff against that program. A hand-maintained copy would drift on day one.
3. **Phase 1 renders today's coach.** The prototype lock binds the project shell the builder must be able to describe. It does not, in phase 1, replace the in-force walk, the locked recording screens, the locked Ideal Text, or the locked consent screens. Where the prototype and a locked screen disagree, the locked screen stays until the founder writes the change on the flow page.
4. **The project-history card is part of the seed, as it shipped on 16 November 2026.** Progress percentage and the four delivery labels stay on that card only. The walk thread and Will's messages still show no number and no verdict.
5. **Pasted code does not run in phase 1.** The builder accepts a paste, stores it, and checks it. "Use it" stays off until a later phase has a sandbox. What can go live in phase 1 is a declarative plugin that points at a component the app already has.
6. **The public link stays the hardcoded Will chat.** That is a locked answer on the decision-contract page (`public_link`). A coach the builder publishes is not what `willpowerlab.com`'s public link opens.
7. **Will may read every project. A project reads only itself.** Locked on the same page. The builder does not get a switch that copies Will's memory into a project.
8. **Practice length is five minutes, not a setting.** The whole-presentation time limit is a project fact, chosen at setup. The builder can change the words of the question. It cannot add a practice-duration picker. The lock forbids that picker.
9. **Calibration dials move by the silent-try path that filler words already use.** The host never sees the raw number. Pinned constants, including the green band, are shown and cannot be edited.
10. **The human coach panel is out of scope.** Blind judging, the queue, and the corpus stay as they are. A coach definition must not reveal the machine's guess to a coach.

---

## 2. Architecture

Three layers. The builder writes the top one. The runtime reads it. The screens are a closed set of components the document may arrange and not replace.

```
CoachDefinition (versioned JSON)
        │
        ▼
coach runtime  ── reads the document, calls the same pickers and the same screens
        │
        ├── chat script          (today's recipe v2 fields)
        ├── project shell        (the prototype's locked interactions)
        ├── walk program         (ordered steps, each bound to a known screen)
        ├── noticing             (dials, pinned constants, silent tries)
        ├── plugins              (declarative now, sandboxed code later)
        └── theme                (tokens, not new components)
```

The runtime is a backend module, called `coach_runtime` in this spec, that sits in front of the functions the audit names (`moment_pick.pick`, `tempo_stretch.pick`, `_one_thing`, `_sniper_first`, `walk_voice.write`, `buildWalkPlan`). Those functions keep their behaviour. They gain a definition argument. When the argument is missing, they use the constants they use today, so a bad document cannot blank the product.

The frontend stops deciding the step order in a private function and asks the runtime for the plan. `buildWalkPlan` remains the renderer of a plan. It stops being the place a new step is invented.

A Take pins the definition version it started with. Saving a draft does not change a walk that is already open. Live preview pins the draft and writes nothing, the way `POST /v2/chats/setup/try` already writes nothing.

Storage, backend:

- `coach_definitions`: `id`, `owner_id`, `slug`, `status` (`draft` or `live`), `head_version`.
- `coach_definition_versions`: immutable `version`, `document` (jsonb), `content_hash`, `created_at`, `parent_version`. A Take stores `coach_definition_id` and `version`.
- The speaking-coach seed is a system row, owner the founder, slug `speaking-coach`. Host recipes gain an optional `coach_id`. Null means what the host chat does today, which is not the walk.
- `noticing_settings` stays the live dial record. A definition's dials are the defaults a new silent try starts from. Promoting a try still writes `noticing_settings`, so there is one place the picker reads.
- Plugins live in `coach_plugins`: `id`, `owner_id`, `content_hash`, `manifest`, `source`, `status` (`draft`, `checked`, `live`, `rejected`). A definition references a plugin by id and hash. A live Take replays that hash.

The host-chat recipe is not migrated into this table. `_derived` in `chat_recipes.py` keeps producing `welcome` and `answer_with` for current readers.

Rings. Phase 1 is the founder, on the existing `chat_builder` ring, editing `speaking-coach`. Other experts wait for phase 3, and a domain of health, law or money still forces "I draft, you send" (`care` on the recipe). That rule moves onto the definition and stays mandatory.

---

## 3. The CoachDefinition

Identifiers are stable strings. Copy is either a literal the founder has already approved, or a reference to the walk-voice step that generates it. The document does not contain a score about a speaker. It may contain a dial's default, which is a setting, not a result.

```ts
type CoachDefinition = {
  schema: 1;
  id: string;                  // "speaking-coach"
  name: string;                // "Speaking coach"
  version: number;             // immutable once published
  // The chat script. Same fields as recipe v2, so the Live/Build screen
  // can keep editing them. See AUDIT.md §3.2.
  chat: {
    spec: string;
    name: string | null;
    line: string;
    hello: string;             // one bubble. The fixed second line is a shell line, below.
    questions: { q: string }[];
    taps: string[];            // stored without "Something else"
    send: ("rec" | "text" | "photo" | "file")[];
    out: "answer" | "words" | "todo" | "mark";
    who: "shadow" | "you" | "assistant";
    care: boolean;
    live: boolean;
  };
  // The project shell. Values must satisfy the prototype lock.
  shell: {
    surfaces: ["feedback_walk", "ideal_text"];   // exactly these two
    primaryAction: {
      beforePractice: "Start recording";
      afterPractice: "Continue recording";
    };
    recordingClockSeconds: 300;         // pinned. Not a dial.
    presentationLimitChoices: (number | "other" | "none")[];
    // 3, 5, 10, 30, 60, "other", "none". "other" is positive whole minutes.
    checkpoint: "slide_and_step";        // the locked "exact checkpoint"
    postWalk: "project_questions";       // Next returns to the project, not to Will
    publicLink: "hardcoded_will";        // locked. Not "this coach".
  };
  // Will, outside the project loop.
  will: {
    composer: "text";
    recording: false;
    readsAllProjects: true;
    principles: "propose_then_accept";   // Accept, Edit, Not now. Never automatic.
    patterns: {
      // Open in the lock: evidence threshold. Default in section 10.
      minProjects: number;
      cadence: "weekly";
    };
  };
  walk: WalkProgram;
  noticing: Noticing;
  plugins: PluginRef[];
  theme: Theme;
};

type WalkProgram = {
  // The One thing walk, in order. Each step names a screen the app already has.
  steps: WalkStep[];
  maxTries: { oneThing: 2; legacy: 3 };
  voice: {
    // The system prompt's rules, today services/prompts/walk_voice.py.
    // Editing this is a prompt change and regenerates the golden set.
    rulesId: string;
    maxSentences: 2;
    maxChars: 220;
    forbidNumbers: true;
  };
};

type WalkStep = {
  key: "page" | "coachnote" | "praise" | "clearer" | "practise"
      | "exVideo" | "tempo" | "coach" | "others" | "words" | "done" | "summary" | "end";
  screen: string;              // a registered component id, see section 4
  when: string;                // a named predicate, not an expression language
  copy: Copy;
  tool?: "clearer" | "ai_clip" | "tempo" | "judge_other" | "none";
};

type Copy =
  | { kind: "fixed"; text: string }          // already-approved line
  | { kind: "voice"; step: string }          // walk_voice writes it
  | { kind: "speaker"; source: "stretch" | "best" | "fix" };

type Noticing = {
  // Defaults for services/noticing_settings.py. Dials only.
  dials: { name: string; default: number | string }[];
  // Shown in the builder, rejected if the document tries to change them.
  pinned: { name: string; value: number | string }[];
};

type PluginRef = {
  id: string;
  hash: string;
  role: "detector" | "step" | "copy";
  interventionType: "REWRITE" | "RESTRUCTURE" | "EMPHASISE" | "DE_EMPHASISE"
                  | "ADD" | "CUT" | "NOTICE" | "REHEARSE";
};

type Theme = {
  canvasMaxPx: 1080;
  color: {
    background: string; foreground: string; muted: string;
    mutedForeground: string; border: string; primary: string;
    primaryForeground: string; record: string;
  };
  radius: { bubble: number; card: number; chunk: number; dock: number };
  type: { bodyPx: number; titlePx: number };
};
```

Predicates in `when` are a closed list, the ones `oneThing` and `_sniper_first` already implement: `always`, `has_coach_note`, `has_strongest`, `one_fix_is_moment`, `one_fix_is_tempo`, `one_fix_is_none`, `from_take_2`, `not_guest`, `practice_on`, `legacy_take`. A definition may turn a predicate off. It may not invent one in phase 1. Inventing one is a plugin of role `detector` plus a new predicate, which is phase 2 and a reviewed change.

The one-fix choice stays in `_one_thing` and `_sniper_first`. The definition supplies the inputs those functions already take: whether tempo is offered, the dial defaults, and which tool a slot uses (`clearer` or `ai_clip`). It does not contain a boolean "always show the sniper". The sniper shows when the stretch is the biggest issue, as it does today. The builder can raise or lower how readily a stretch counts (`tempo_stretch.MIN_OUTSIDE`), through a silent try, and can turn the tempo step off for this coach.

### 3.1 Mapping from the hardcoded coach

The left column is what the audit found. The right column is the field that holds it. "Seed" means the generated `speaking-coach` document sets it to today's value. "Pinned" means the schema has the field and the runtime rejects a different value until the founder changes the lock.

| Hardcoded piece | Field |
|---|---|
| Recipe hello, taps, questions, send, who answers | `chat.*` |
| The second bubble "Tell me what you'd like to do, and I'll show you where." | `shell` line `invite`, seed that sentence. Live stops stacking it when the hello already asks |
| "You run this chat." | `shell` subtitle, seed that sentence, owner-only |
| "Something else" always last | runtime, not stored. A definition that includes it is refused, as v2 refuses it today |
| Walk order in `buildWalkPlan` / `oneThing` | `walk.steps` |
| `ONE_THING_TRIES` 2, `WALK_MAX_TRIES` 3 | `walk.maxTries` |
| Step screens (`WalkTempo`, `WalkMessage`, `WalkPractiseScreens`, `WalkOthers`, `WalkAiVoice`, `WalkEndSheet`, …) | `walk.steps[].screen`, from the registry in section 4 |
| "Lesson done.", helper-words introduction, "And here's one moment to try another way:" | `walk.steps[].copy` of kind `fixed` |
| Will's generated sentences | `walk.steps[].copy` of kind `voice`, rules `walk.voice.rulesId` |
| Helper words taken from the stretch or the fix | `copy` of kind `speaker` |
| `one_fix` tempo / moment / none | not a field. Computed. The definition only says the tempo step is offered |
| Green band 0.275–0.725 | `noticing.pinned` `tempo_stretch.GREEN_LOW` / `GREEN_HIGH` |
| `MIN_OUTSIDE` 0.25 and the other dials | `noticing.dials` |
| Ranks (`VERBAL_LIFT` and the rest) | not in the document in phase 1. They stay code. Section 5 |
| `moment_pick.FLOOR` 0.6 | `noticing.dials` `moment_pick.FLOOR` |
| Pace replay constants (`FRAME_MS`, rise and fall) | pinned, named, shown read-only. They must match `paceSignal.ts` `INSTANT_CONFIG` |
| `_sniper_first` comparison | not a field. The rule stays. The dial changes the input |
| Plan levels that count as a pace week | `walk.tempoWeeks`, seed `["key_line", "pauses"]` |
| Project card: name, Progress, chunks, attempts, delivery label, Feedback, Ideal text | `shell.historyCard`, seed matching `FeedbackWalkCard.tsx` |
| Delivery labels and the score bands in `_delivery_read` | `shell.historyCard.labels`, seed the four words. The numeric bands stay server-side and are not a builder field in phase 1 |
| Five-minute clock | `shell.recordingClockSeconds`, pinned 300 |
| Presentation limit choices | `shell.presentationLimitChoices` |
| Ideal Text at the end of a fragment | `shell.idealText`: `continue` and `repeat` labels, pinned to the lock's two buttons |
| Post-walk questions (audience, intent, alignment) | `shell.questions[]`, each `{ q, taps[] }`. Seed the three prototype questions only when the founder puts those words on the flow page. Until then the seed keeps the questions the lounge already asks |
| Sunday-note errors: Rushing, Ending compression, Hedging, Word compression, Filler words | `will.errors[]`, seed that list. "Name a new error" creates a plugin draft and routes no exercise |
| Theme tokens | `theme`, seed from `globals.css` and the prototype's `:root` variables |
| 1080px canvas | `theme.canvasMaxPx`, pinned |
| Coach panel, consent copy, Ideal Text generator, transcription | not expressible. Section 5 |
| `user_sniper_profile` growth score | not expressible, and must stay off every screen |

### 3.2 The speaking-coach seed, in words

A speaker with this document meets the coach they meet today.

- Chat name and hello are the founder's. The seed does not invent "Hi there! I'm excited to help you with your speaking skills." That sentence is Artur's host-chat recipe, and it stays on the recipe. The seed's hello is the speaking-coach suggestion only if he has not already approved a different line. Phase 1 does not change his recipe.
- The walk is the One thing walk, including the sniper when `_sniper_first` says so.
- The project card is the card that shipped on 16 November 2026.
- The recording clock is five minutes. The presentation limit is whatever the project stored.
- Will keeps the plan card and the text composer. He gains no recording button.
- Principles stay propose-then-accept.
- Dials sit at `noticing_settings` defaults.
- Plugins is empty. Tempo is a built-in step, not a plugin, until someone duplicates it.

### 3.3 What the schema cannot express yet

These stay code. The builder says so, in the words the setup already uses ("not ready yet"), and offers "I want this", which files a note and does not pretend to have saved a behaviour.

- The eight intervention types. A ninth type is an architecture change, as Appendix C says. A plugin picks one of the eight.
- Ranking weights (`VERBAL_LIFT` and the other ranks). They change who wins a slot, which is not a yes/no the founder can see. Left out of phase 1 so a silent try has a result a person can judge.
- The Ideal Text generator, the transcript, and the "only what they said" rule.
- Consent, the legal texts, and the processing-authorization path.
- The coach panel and blind judging.
- Detector math (how the pace scale moves, how willfidence is computed). The builder can move a dial. It cannot replace the formula with a paste in phase 1.
- A new walk screen. The registry is closed until a frontend change adds a component id.
- Automatic principles. The lock forbids them.
- Routing the public link at a built coach. The decision contract forbids it for now.
- Per-speaker growth scores from `user_sniper_profile`.

---

## 4. Plugins

A plugin is how a new intervention arrives. The prototype already states the rule, in the Sunday lens: a new error is observed only, and it routes no exercise until a detector can hear it.

### 4.1 The registry

Screens the definition may name in phase 1, each an existing component:

| Id | Component |
|---|---|
| `walk.page` | the deck page |
| `walk.message` | `WalkMessage.tsx` |
| `walk.audio` | the orange audio bubble (`WalkPlayer.tsx`, prototype `wlp-walk-audio`) |
| `walk.clearer` | Clearer version |
| `walk.practise` | `WalkPractiseScreens.tsx` |
| `walk.tempo` | `WalkTempo.tsx` |
| `walk.aiVoice` | `WalkAiVoice.tsx` |
| `walk.others` | `WalkOthers.tsx` |
| `walk.words` | helper words |
| `walk.done` | "Lesson done." |
| `walk.end` | `WalkEndSheet.tsx` |
| `shell.historyCard` | `FeedbackWalkCard.tsx` |
| `shell.idealText` | the Ideal Text overlay |
| `shell.recording` | the locked recording screen |
| `shell.picker` | saved-slide picker |
| `will.composer` | the text composer |
| `will.sunday` | the Sunday lens |
| `will.plan` | the plan card |

A definition that names an id outside this list is refused with `COACH_UNKNOWN_SCREEN`. Adding an id is a frontend change, a flow-page line, and a founder line. It is not a paste.

### 4.2 What "paste the code" does

The builder's line is the one the owner asked for: "So you want a new intervention? Paste the code here."

The paste is stored as a plugin draft.

1. The host pastes. The client sends the text to `POST /v2/coaches/<id>/plugins`. Limit 32 KB. The server stores the source, the sha256, and the status `draft`. It does not import it.
2. A static check runs. It looks for a manifest in the first lines, as a comment block:

   ```
   id: hedge-restart
   role: detector
   interventionType: REWRITE
   hears: hedging
   step: walk.message
   ```

   `interventionType` must be one of the eight. `step` must be a registry id. `hears` must be a short name, not code.
3. The check rejects the paste if the source mentions network, filesystem, subprocess, `eval`, `exec`, a secret-shaped assignment, or an import outside an allowlist that phase 2 will publish. The host sees which rule failed, in one sentence, and the draft stays `rejected` or returns to `draft` after an edit.
4. A paste that passes is `checked`. It still does not run. The builder says it is kept, and that speakers will not meet it until "Use it", and that "Use it" is not available yet.
5. Phase 2 turns "Use it" on for `role: detector` only. The runner is a subprocess with no network, a 50 ms budget per clip, a memory cap, and a single output: a `Finding` in the Appendix C shape (id, type, anchor, evidence). The type decides the screen, not the plugin. A plugin that returns anything else is a failed clip, logged, and the walk continues without it.
6. A component paste, `role` implied by JSX or a React import, is refused in every phase this spec covers. The host is told the screen has to be one of the registry, and is offered the declarative form: which screen, which fixed line, which predicate.

Versioning. The hash is the version. A definition that goes live names the hash. A later paste is a new hash. Takes that started on the old hash finish on it. There is no in-place edit of a live plugin.

This is stricter than the sentence "paste the code and wire it in." It is the version that can sit next to blind coaching, the processing-authorization path, and a prompt that is forbidden to leak numbers. Section 10 asks whether phase 2 should loosen it.

Declarative plugins need no paste. "Add an intervention" can also be: pick a type, pick a screen, pick a predicate, write the line. That path is enough to rebuild the tempo step as data: type `REHEARSE`, screen `walk.tempo`, predicate `one_fix_is_tempo`, copy from the speaker's stretch. Phase 1 ships that path. The paste path stores and checks, and wires nothing.

---

## 5. The builder, as a conversation

The visual language is the one the blank setup and the decision-contract page already use. One question. Two answers, or a short row of chips. The recommended one is marked. The answer saves, and the next question opens. Back returns to the previous question. No form with twelve fields. No code editor as the home screen.

The existing Keep / Change parts (name, hello, taps, models, who answers) stay as they are. New coach questions are binary. "Tick all that apply" stays only where the founder already approved it (what people send, which of the three walk pieces). New work does not add a second multi-select pattern.

Build and Live:

- **Build** is this conversation, over the definition's draft. The parts the host already sees ("Your chat", "AI models", the walk's four parts) become the top of the tree. Under "The feedback walk" the new branches appear: its steps, what I notice, what I say, the pace step, the card, the recording clock (read-only), the theme.
- **Live** is the project chat and, when he asks, the walk, rendered from the draft against a fixture Take. It writes no Take, spends no tokens, and shows a quiet "Preview" only in the builder chrome, never inside the coach surface (`no-prototype-explanations`). The fixture is a real past Take of the founder's, chosen once, not the prototype's "like a diamond" paragraph, unless he picks that Take.
- The switch stays the Live/Build control he already has. It starts showing once the draft has a hello, which is today's `can_try`.
- Leaving Live does not publish. Publishing is its own question: "Open this version to you?" and later, separately, "Open it to a speaker?" Phase 1's second answer is only the founder. The public link is unaffected.

### 5.1 Create the coach

He already has a chat. The builder does not ask him to start from zero.

> Will: Your chat is open. The speaking coach is still the one in the app. Want to build it from here?
> Chips: **Yes, start from today's coach** · Not now

Yes copies the seed into a draft and opens the parts. Not now leaves the seed live and the draft uncreated. There is no third choice and no blank coach. A blank coach cannot pass the parity test, and it would publish an empty walk.

### 5.2 Edit the pace step

> Will: The pace step is on. It practises a stretch that runs past the green.
> Chips: **Keep it** · Change it

Change it:

> Will: When should it be the one thing they practise?
> Chips: **When rushing outweighs the moment** · Only on a pace week · Never

"When rushing outweighs the moment" is today's `_sniper_first`. "Only on a pace week" is the older rule, still expressible as a predicate switch. "Never" sets the tempo step off.

Then, only if it is on:

> Will: Catch a shorter rush, or only a long one?
> Chips: **Catch more** · Keep · Catch fewer

That is the silent try on `tempo_stretch.MIN_OUTSIDE`. The copy is the filler-word copy, already approved: "I'll try catching more on the next 20 recordings, silently. Nobody sees a change." He does not see 0.25.

> Will: The green band is fixed, because the meter on the phone uses the same band.
> Chips: **Leave it**

One chip. Pinned.

### 5.3 Add an intervention by pasting

> Will: So you want a new intervention? Paste the code here.
> The bar's box is open. Placeholder: Paste here

He pastes. The check runs.

If the manifest is missing:

> Will: I kept the paste. I need five lines at the top: what it notices, which of the eight kinds it is, and which screen it uses. Want the list?
> Chips: **Show the five lines** · I'll write them

If it asks for a new screen:

> Will: That screen isn't one of ours. I can put your line on a screen we have, or keep the paste as a note.
> Chips: **Use a message** · Use the pace screen · Keep it as a note

If the check passes:

> Will: Kept. It notices hedging and would ask them to change the words. It is not in the coach yet. Use it stays off until the runner exists.
> Chips: **Leave it as a draft** · Throw it away

He never gets a "it's live" confirmation in phase 1.

### 5.4 Tweak calibration

> Will: This is what I notice in a message. Tap one.
> Rows: A rushed moment · Filler words · Hedging · Restarts · Words that need a rewrite · A voice that sounds unsure · A moment that needs a fix · Saying the key line

Each row opens the same Catch more / Keep / Catch fewer question, and the same silent try. Filler words already does this. The others gain the same door. A row with a try in flight shows "Trying: catch more" and does not start a second one (`silent_tries` already allows one try per thing).

Ranks are not in the list.

### 5.5 Change a visual element

> Will: Which piece?
> Chips: **The bubbles** · The card · The buttons · The colour

Colour:

> Will: The orange is #ff6a14. Keep it, or use another?
> Chips: **Keep** · Pick another

Pick another opens the bar's box. A value that is not a colour is refused. The canvas width is not in this menu. A change of colour is a draft theme token. Live preview shows it. It is not on a speaker's phone until he publishes, and phase 1 publish is to himself.

The card:

> Will: The card shows the slide range, the attempts, the delivery word, and the progress bar.
> Chips: **Keep all of it** · Hide the progress bar

Hide the progress bar is the only subtraction. He cannot add a second percentage, and he cannot put the bar inside the walk. The four delivery words are a chip row of Keep / Change, and Change asks for a new word, checked by `check_host_words`, so a number in the label is refused. Replacing "Good" with "Fine" is allowed only as a founder-approved line. Until that approval, Change on a delivery word answers "That word is locked" and does not save. This is the "no new words" rule, applied inside the builder.

### 5.6 A second expert, later

The same tree. The first question changes.

> Will: What do you do?
> He types: Trichologist

The seed is not the speaking coach. `chat` fills from `chat_suggestions.py` as it does today (scalp photo, the hair hello). `walk.steps` starts empty. `shell.recordingClockSeconds` stays 300 only if he turns recording on. A photo skill has no pace step and no Ideal Text unless he adds them. `care` is asked, and a yes forces `who` to "you". He can add a declarative plugin ("Is this a dry scalp?", type `NOTICE`, screen `walk.message`) because that is a model card the recipe already knows how to store. He cannot paste a detector that runs. The public link still opens Will.

That is the phase 3 shape. Phase 1 does not offer "Trichologist" as a new coach. It offers it only as the host chat the setup already creates today.

---

## 6. Backend and frontend changes, when this is built

Not in this pull request. Listed so the later work has a boundary.

Backend:

- Tables in section 2. Idempotent migrations, no drops.
- `services/coach_runtime.py` loads a version and hands dials, the step list, and plugin hashes to the existing functions.
- `moment_pick`, `tempo_stretch`, `_one_thing`, `_sniper_first` take an optional definition. Absent means today's constants.
- `POST /v2/coaches`, `GET /v2/coaches/:id`, `PUT /v2/coaches/:id/draft` (one part, the way `set_part` works), `POST /v2/coaches/:id/publish` (founder only in phase 1), `POST /v2/coaches/:id/preview` (fixture Take, no write).
- `POST /v2/coaches/:id/plugins` stores and checks. It does not execute.
- A Take's row gains `coach_definition_id` and `coach_version`, nullable. Null means the hardcoded path, so old Takes do not move.
- `chat_recipes` gains an optional `coach_id` on the recipe. The walk part (`best` / `fix` / `words`) remains, and is derived from `walk.steps` when a coach is attached, so current screens keep reading it.
- Preview and publish go through the processing-authorization path when they touch a real recording. The fixture preview uses a recording that was already authorized.

Frontend:

- `buildWalkPlan` takes the runtime's plan as input. The private `oneThing` order becomes the seed's order, checked by the parity test.
- Live, when the draft has a coach, renders `ProjectChat` and the walk from the draft instead of only `HostOwnChat`. The chat dry-run remains for a recipe with no coach.
- New builder branches are components beside `hostsetup/`, using `hostSetupCopy` for any line that already exists and adding no line that the flow page does not have. New lines wait for the founder.
- The registry in section 4 is a map from id to component. Unknown id renders nothing and logs.

What must keep working, from `CLAUDE.md`: every moment still reaches a coach, every Take still reaches the people the speaker chose, the coach's link still opens the coach's feedback while something else is processing, and Will still keeps the speaker's answers and the private note.

---

## 7. Phased plan

### Phase 1. The speaking coach, from the document, identical

End state: the founder can open Build, walk the tree, and Live shows the coach he already has. A speaker who is not him still runs the hardcoded path until he publishes, and the first publish is to his own account. Side by side, his account and a fixture account produce the same walk.

Work:

- Generate the seed. Check it in as a fixture, not as a hand-written twin that someone edits.
- Runtime reads the seed and calls the existing functions.
- Parity tests, section 8, green.
- Builder branches that edit copy, dials (as silent tries), step order among the known steps, and theme tokens. Paste stores a draft and does not run.
- Live preview against one fixture Take.
- No change to the public link, the coach panel, consent, or Ideal Text generation.

The project-shell gaps the audit lists (Continue recording does not yet open the Ideal Text decision; the walk's Next does not yet return to the prototype's three questions) are **not** phase 1 of the builder. They are unfinished prototype work on the app itself, already in the flow page's history. The builder describes the shell. It does not smuggle a redesign of a locked screen.

### Phase 2. A running plugin, still the speaking coach

- The detector sandbox, "Use it", and a Take pinned to a plugin hash.
- One real plugin as the proof: a declarative tempo step that reproduces the built-in one, then the built-in one deleted only after the parity test names the plugin. One in, one out.
- Ranks stay code unless a silent try can show the host a result in words.

### Phase 3. Another expert

- A second definition, not `speaking-coach`, created from "What do you do?"
- Recording and the walk optional. A photo skill can be a chat plus `NOTICE` plugins and no walk.
- `care` still forces a human to send.
- The public link still opens hardcoded Will until the locked `public_link` answer is explicitly changed and the lock file is edited in the same change.
- Marketplace models stay the recipe's models. They are not plugins. A model that returns a pick and a plugin that emits a Finding meet only in the walk's step list, by the host ordering them.

---

## 8. Parity tests

Business behaviour, not snapshots of CSS. A test that mocks the whole pipeline is the wrong test. The ones below are small.

1. **Seed matches the constants.** A test reads `noticing_settings.DEFAULTS`, `moment_pick.FLOOR`, `GREEN_LOW`, `GREEN_HIGH`, `MIN_OUTSIDE`, `ONE_THING_TRIES`, and the step keys `oneThing` emits for three fixture plans (praise only, moment fix, tempo fix). It compares them to the checked-in seed. A constant that moves without the seed fails.
2. **Same plan.** For one golden Take (snippets, word timings, a pace stretch, three moments), the hardcoded `buildWalkPlan` and the runtime's plan have the same step keys, the same `one_fix`, and the same helper-word source. This is the test that would have caught a builder that "simplifies" the sniper away.
3. **Same words, where the words are fixed.** "Lesson done." and the helper-words introduction match the flow page. Generated lines are not compared character for character. They go through `walk_voice.check`, and the existing golden set still grades the prompt.
4. **Numbers stay off the walk.** The runtime's plan for the golden Take contains no digit in any fixed line. The history card's percentage is asserted on the card payload and asserted absent from the walk payload.
5. **Preview writes nothing.** `POST .../preview` leaves Takes, recipes, and `noticing_settings` unchanged.
6. **A bad document falls open.** A definition that names an unknown screen, changes a pinned constant, or sets the clock to anything but 300 is refused. The live seed is untouched.
7. **The prototype lock still passes.** `node docs/chat-builder/reference/verify-prototype-lock.mjs` stays in CI for as long as those files are the contract. It does not prove the app matches the prototype. It proves nobody edited the contract quietly.
8. **Plugin paste does not import.** A paste containing `eval` or a network call is stored as rejected, and no module loader is invoked. A test that only checks the status code is enough.

Visual parity of the card is the existing `FeedbackWalkCard` test and the flow-page line of 16 November 2026, not a new screenshot suite. The lock's canvas, the two result surfaces, and the single recording button are worth one DOM test each on `ProjectChat`, because a miss there breaks the locked contract. They are not worth a pixel diff.

---

## 9. Risks

- **Two truths.** The walk's order would live in `buildWalkPlan` and in the seed. The parity test is the only thing that keeps them one. Phase 1 should delete the private order as soon as the test is green, and keep the function as a renderer. Waiting "for safety" is how the drift starts.
- **The recipe and the coach both think they own the walk.** v2 already stores `walk.steps`. If both are writable, a host will edit one and preview the other. The spec makes the coach the source and derives the recipe field. The derivation has to be the only writer.
- **Pinned constants duplicated on the phone.** The green band and the rise/fall times exist in Python and in `paceSignal.ts`. A builder that edited the Python copy would desync the meter. They are pinned, and the seed test reads both files.
- **Scores leaking through the card.** The card's percentage is an approved exception. A generic "progress" field on every step would undo `walk_voice` and `CLAUDE.md`. The schema has the percentage on `shell.historyCard` and nowhere else, and test 4 guards it.
- **Paste that is almost code.** A declarative manifest inside a Python file will be mistaken for a running plugin. The builder's confirmation has to say it is not live. Copy that says "wired in" would be a false promise.
- **Locked screens edited from a theme token.** Colour is safe. Changing the Ideal Text's buttons, or putting a duration picker back, is not. The schema pins those. A theme object that accepts arbitrary CSS is the hole. Phase 1's theme is the named tokens in section 3 and nothing else.
- **Preview that uses a real Take of someone else.** The fixture is the founder's own past Take. A preview that accepted an arbitrary session id would show another speaker's words to the builder.
- **Phase 3 experts and medical advice.** `care` forces a draft a human sends. A plugin that "notices a diagnosis" is still a `NOTICE` the human sends. The schema does not have a path around that.
- **The old sniper tables.** Someone will find `user_sniper_profile` and wire it into the card as a growth score. The audit says not to. The schema has no field for it.
- **Prototype dead code.** `openPracticeTimeSheet` is still in the HTML. Copying the prototype component for component would resurrect a picker the lock removed. The builder's recording section is read-only on purpose.
- **Docs drift.** This file is Reference. The day a phase is built, the flow page changes and this file's relevant section is either promoted by a decisions-log entry or deleted. Leaving it as a second rule book is the failure the docs guard exists to prevent.

---

## 10. Open questions

Ordered by how much the answer moves the design. The recommended default is the call this spec already uses.

1. **Is phase 1 parity the lounge walk, the project chat, or both?**
   The lounge is the coach people use. The project chat is the shell the prototype locks, and it is only partly built. Defining parity as "both, and the walk they open is the same function" is the recommendation. Defining it as the project chat alone would let the lounge keep a second script forever. Defining it as the lounge alone would ignore the lock.
   **Default:** both shells, one walk function, one seed.

2. **May any number besides the project card's Progress percentage reach a speaker?**
   The card is an approved exception as of 16 November 2026. The walk prompt still forbids numbers. Allowing the builder to place a percentage on a step would undo that.
   **Default:** the card only. The builder may hide the card's bar. It may not move the bar.

3. **Should a paste ever execute?**
   Phase 1 stores and checks. Phase 2 runs a detector in a sandbox that can only emit a Finding. Arbitrary UI code never runs.
   **Default:** that split. If the answer is "no code, ever", delete phase 2's runner and keep the declarative path. If the answer is "run what I paste", the sandbox, the hash pin, and the closed intervention types still stand. Those are not optional.

4. **Does the builder edit the live speaking coach, or a draft the founder publishes onto himself first?**
   A save that rewrote production would make the parity test a production incident.
   **Default:** draft, preview, publish to the founder, then a separate question to let a speaker in. The public link stays on the hardcoded coach.

5. **One coach per person, or many?**
   The schema allows many. The phase 1 UI creates one draft from the seed and does not offer a list of coaches.
   **Default:** many in the data, one in the UI, until phase 3.

6. **Replace recipe v2, or wrap it?**
   Replacing it breaks every host chat and the Live/Build screen that just shipped. Wrapping it leaves two writers unless the derivation in section 6 is the only one.
   **Default:** wrap, and derive `walk` on the recipe from the coach.

7. **Are Will's walk lines a script or a prompt?**
   Fixed lines exist and are locked. The rest are generated from `walk_voice` because the founder asked for rules rather than canned sentences.
   **Default:** both, as `Copy` in section 3. The builder can change a fixed line only when that line is not on the flow page. A generated step has no text field, only the rules id.

8. **Are dials per coach or per speaker?**
   A coach default that silently moved every speaker's floor would change feedback they are mid-way through.
   **Default:** the definition holds the default. A silent try is still per speaker, against that default. Publishing a new default starts no try by itself. It applies to Takes that pin the new version.

9. **How exact is the checkpoint?**
   The decision contract's recommended answer, which this spec treats as the target, is slide plus intervention plus step. The app stores slide and duration on the phone.
   **Default:** the server stores slide, step key, and definition version. The phone cache is a hint. This is backend work inside phase 1's runtime, not a new screen.

10. **Which post-walk questions are the seed?**
    The prototype's three ("Who were you talking to?", the feeling, "Does that match what you wanted?") are sample copy. The lounge already asks its own questions, and new words need approval.
    **Default:** the seed keeps the lounge's existing questions. The prototype's three are a variant the builder can preview and cannot publish until the flow page has them.

11. **Does Will keep the plan card?**
    The lock says Will holds patterns, principles, mindset, and a text composer, and no recording. The prototype still draws the plan and "Today, one thing." The verifier does not forbid them.
    **Default:** the plan stays in Will. It is not a recording action. Removing it would be a change to [`docs/flows/the-plan.md`](../flows/the-plan.md), asked separately.

12. **When is a cross-project pattern strong enough?**
    The lock leaves this open (`openForDesign`). The scope form offers two projects, three, one as a hypothesis, or only after the person confirms.
    **Default:** three projects, weekly, and Will only proposes. The person accepts, edits, or says not now. One project never creates a principle. "Automatically" is not available, because the lock forbids it.

13. **Where does the presentation time limit live?**
    It is a fact about a talk, not about the coach. The five-minute clock is a fact about practice.
    **Default:** the limit is on the project. The coach owns the question wording and the choice list. The clock stays 300 and pinned.

14. **Do marketplace models and plugins share a store?**
    Models already have an exam, a price, and a pick. Plugins emit Findings and choose a screen.
    **Default:** separate stores. Phase 3 can order both in the step list. It does not merge the tables.

15. **Who may publish a coach that is not speaking, and when?**
    **Default:** the founder in phase 1 and 2. Another expert in phase 3, on the `chat_builder` ring, with `care` forcing a human send. Nobody's coach is what the public link opens until question 4's lock is changed on purpose.
