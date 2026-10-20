# Designer brief — Wave 5 (October 2026)

**For the designer's session.** Founder decisions, decisions log N48.6
(2026-10-05), verbatim:

> Q28 A: the designer draws, in order, coach words to the speaker, praise
> after practice, the share switch with Lend your ear and the delayed
> measure, then Bold voices.
>
> Q29 A: the nine praise lines and three rewrite moves are drafted by the
> session for the founder's signature.
>
> Q30 A: the exercise fallback ladder stays off until three general exercises
> are filmed.

This brief covers Q28 A. Its four sections follow the founder's order. Each
section gives:

- what the screen must do, with the contract clauses and lock items it
  implements;
- the backend endpoints and fields it reads;
- the switch that turns it on and where that switch lives;
- the copy that is signed and the copy still needed;
- the acceptance checks;
- the audit lines it closes, from the Closing the Gap plan's workstreams W5
  ("The coach's words reach the speaker") and W11 ("After-practice and
  listening lanes").

Q29 A is drafted separately, for the founder to sign:
`backend-cursor/docs/SIGN-praise-lines-and-rewrite-moves-2026-10.md`. Q30 A
needs no screen: the ladder stays off, and a test pins it
(`backend-cursor/tests/test_exercise_fallback_ladder.py`).

## How to read the citations

- A plain path is in this repo (frontend). A `backend-cursor/` path is in the
  backend repo.
- Line numbers are those of frontend `c75b5c5c` and backend `9a97f486`, plus
  this wave's branch. Symbol names are given too, so a reference survives a
  line moving.
- "Contract N" is `backend-cursor/docs/CANONICAL_PRODUCT_CONTRACT.md` clause N.
- "Lock" items:
  - the **helper-words lock** (B, D, Q items):
    `backend-cursor/docs/FOUNDER-LOCK-helper-words-2026-09-30.md`;
  - the **coach-panel lock** (A, B, C, E items):
    `backend-cursor/docs/FOUNDER-LOCK-coach-panel-2026-10.md`;
  - the **design lock** ("Ideal Text Final Screens", L items):
    <https://claude.ai/artifact/AeRVS91VUAiJLCePB82s3d>, as amended in this
    repo's `CLAUDE.md` (section "Design lock").
- "N" items are entries in `backend-cursor/docs/SPEC-DECISIONS-LOG.md`.

## Rules for every screen in this brief

1. **The design lock holds.** These screens touch the speaker's Ideal Text
   sheets. Only this designer's session changes their layout, flow or
   wording. Every new element and every new string goes to the founder
   before it ships. Wiring-only changes are allowed (N29.5): mapping a field,
   a handler, reading a status.
2. **No string ships unsigned.** A string the founder has not signed goes
   into a copy module marked PROPOSED, behind a constant that is off, and is
   listed for the founder. Each section below names the signed strings and the
   missing ones.
3. **AC-9.** No score, number, band, rank, percentage or verdict reaches the
   speaker. Several payloads below carry routing words: `key`, `lane`,
   `cue`, `error`, `variant`, `kind`, `stratum`, `answered`/`of`. These are
   data for the screen, never text on it.
4. **BLIND COACH.** Nothing the coach drafted, rated or decided reaches the
   speaker except what the coach explicitly shared. No machine guess appears
   as a badge.
5. **LIVE LOOP.** Nothing here waits for a coach or blocks
   record → process → Ideal Text → next Take. Every screen is optional. Each
   one skips itself when its data is absent or its route answers 404.
6. **L1, L2, L3.**
   - L1: the Paragraph changes only with a Take or the speaker's own Accept.
   - L2: no Feedback item is invented to fill a screen.
   - L3: a listener's answer, a coach's answer and the speaker's own answer
     never merge.
7. **Switches are reviewed changes.** Every backend switch below is a
   constant in `backend-cursor/config.py`, not an environment variable. It
   flips in one reviewed PR after the founder's yes, and only once its
   screen has shipped (N29.6, N42).

---

## 1. Coach words to the speaker (W5)

### What it must do

1. **Show the coach's shared answer in words on the moment it answers**
   (contract 35g-2; coach-panel lock E4, C3, A6, B3).
   - A coach answers a moment once, after their own blind rating
     (contract 34, 35g-5).
   - An answer in words is one of three kinds:
     - a **praise line** (kind `line`);
     - a **clearer version** (kind `version`);
     - a **note**: the coach's personal line, signed by them (kind `note`;
       coach-panel lock C1).
   - Any of the three may carry the coach's **video** (coach-panel lock A5).
   - Once shared, the answer "rides on that same item" (contract 35g-2). Today
     it reaches the speaker's payload as `coach_answer` and nothing renders
     it. The founder parked its placement with this session (N45 Q7).
2. **One card per moment** (coach-panel lock C3). The moment's card is still
   chosen by the follow-up matrix (contract 24f; `open_card`), and the
   coach's answer belongs to that same moment. Where it sits on the card is
   the designer's to propose and the founder's to approve (open question
   1.1).
3. **A coach's clearer version is a proposal the speaker may accept or
   leave** (contract 37, 40, 29b).
   - "Accept and practise" writes a new version of the Paragraph, which
     History shows as "Correction accepted", and practises the accepted
     words.
   - "Keep my words" changes nothing.
   - The coach never edits the Paragraph (L1, contract 40); the speaker's
     Accept does.
   - Routine agreement stays silent (contract 37).
4. **Item-level and on its own** (contract 39, 41).
   - Each answer appears on its moment the first time the page is read after
     the coach shares it.
   - No "Reviewed" badge, no Take-level gate, no autoplay.
   - The Take word ("Your coach · Take N", Step 0) is already built
     (`src/components/willab/CoachMessageSheet.tsx`) and stays as it is.
     Under N48.3 Q11, Step 0 opens whenever an unseen word exists.
5. **The exercise's introduction line** (W5 P1-6d, "six introductions").
   - Each library exercise carries two lines of introduction: one for a
     moment read confident, one for a moment read weak.
   - The payload carries the right one as `practice_exercise.introduction`,
     or a built-in default when the exercise has none
     (`backend-cursor/services/confident_voice_practice.py:35-39`,
     `INTRO_NEAR`). No screen shows it today.
   - The Exercise step's "Your coach" card (`DeckChunkModal.tsx`, the
     `exercise-coach-card` block, around line 1833) already shows the
     exercise's video and instruction. It is the obvious home for the line,
     if the founder wants it shown (open question 1.4).
6. **The coach's side of the same words.** This is the coach panel, which
   the design lock does not cover. Its screens are still this session's.
   - **35g-8:** on a note's Words screen, the coach asks for the model's draft
     of their personal line. The draft shows in the field they edit, under
     the signed label "Drafted from this Take · edit every word". The client
     exists: `src/services/api/coachPanel.ts:158-169` (`draftMomentLine`). No
     screen imports it.
   - **Coach-panel lock A3** says an answer is the same three screens for
     every kind: Words, Video, Home. A note has Words and Video only
     (`src/lib/willab/coachAnswer.ts:48-52`) and is shared from the Video
     step (`src/components/willab/coachwalk/CoachAnswerOverlay.tsx:166-180`).
     See open question 1.2.
   - **Where Home files to** (coach-panel lock A6, A8):
     - an exercise goes into the coach's Library, `/coach/exercises`. Since
       #612 it has a door in the coach menu, "Library", for coaches only
       (`src/components/AppMenu.tsx:211-222`; N48.5 Q25 A);
     - a praise line goes into the catalogue of signed lines (35f), unless
       the coach keeps it to the speaker
       (`backend-cursor/services/exercise_coach_requests.py:241-276`);
     - a clearer version and a note are filed nowhere.

### Backend endpoints and fields

**The speaker reads the moment.**

- **Route:** `GET /v2/explore/arc/<arc_id>/ideal-text/enrichment`
  (`backend-cursor/routes/v2/explore_ideal_text.py:667`).
- **Rows:** `document_layers.changes[]`, from the stored bake when it is
  current, else computed live
  (`backend-cursor/services/ideal_text_feedback_bake.py:99-160`).
- **Fields on a Confident Voice row:**

  | Field | Shape | Where set |
  |---|---|---|
  | `coach_answer` | `{kind: "line" \| "version" \| "note", text: string, video_url?: string}`. Present only once the coach shared it (`shared_at`). Never the draft, never a score. | `backend-cursor/services/confident_voice_practice.py:1706-1720` (`coach_shared_answer`), attached at `:1390-1398` (`_annotate_coach_answers`) |
  | `coach_request` | `{status: "open" \| "answered", kind: "error" \| "praise" \| "rewrite" \| "ambiguity"}`. Always `answered` once words were shared (`:1396-1397`). Otherwise present only while a coach is on the panel (`:1404-1408`). | same function; `coach_on_panel` `:1677` |
  | `practice_exercise.chosen_by_coach` | `true` for an exercise the coach shared | `_annotate_coach_answers` |
  | `practice_exercise.introduction` | string: the introduction line for this clip's read | `confident_voice_practice.py:1134-1146` (`_offer_payload`) |
  | `open_card` | `"praise" \| "exercise" \| "coach_request" \| "rewrite"`: the matrix cell | `backend-cursor/services/ideal_text_changes.py` (`_open_cards`) |

- **Unread by decision:** `coach_answer` is in `UNRENDERED_ROW_FIELDS`
  (`backend-cursor/services/take_feedback_manager.py:391`). It rides the
  payload but no client reads it yet (N45 Q7).

**The frontend today** (wiring only, which the design lock allows):

- `mapDocumentSuggestion` (`src/services/api/idealText.ts:718-805`) reads no
  `coach_answer`.
- Add `coachAnswer: {kind, text, videoUrl} | null` to `DocumentSuggestion`
  (`idealText.ts:228` onward). Once the client reads it, move `coach_answer`
  from `UNRENDERED_ROW_FIELDS` to `CLIENT_READ_ROW_FIELDS` in the backend the
  same day. The pinning test is
  `backend-cursor/tests/test_verbal_lanes_take_document_n48_1.py`.
- The card choice is `src/lib/willab/paragraphOverlay.ts`:
  - `routedCard` at `:202-244`;
  - `practiseCardOf` at `:246`;
  - `praiseCard` and `rewriteCard` at `:163-181`;
  - `coachKeepsIt` at `:186-191`.
- The card body is `PractiseCardView` in
  `src/components/willab/ParagraphSheet.tsx:217-276`.

**The coach writes the answer** (all behind the blind gate):

| Route | Body → answer | Code |
|---|---|---|
| `PUT /v2/coach/sessions/<sid>/snippets/<snip>/exercise-request` | `{resolution: "line_written" \| "version_written" \| "note_written", answer_text, share_with_user: true, pattern_key?, file_in_catalogue?}` → `{request}` | `backend-cursor/routes/v2/coach.py:1615-1651`; `backend-cursor/services/exercise_coach_requests.py:30-36, 198-276` |
| `POST …/exercise-request/video` (multipart `video_file`) | → `{video_url}`, which rides `coach_answer` once the answer is shared | `coach.py:1730-1749` |
| `POST …/moment-line/draft` | `{notes?}` → `{draft: {surface: "coach_moment_line", text, model_version, label}}`; 409 once answered | `backend-cursor/routes/v2/coach_words.py:54-71` |

**Engineering this screen needs first** (not screens):

1. **A coach's share must reach a page whose feedback is stored.**
   - The page serves the stored bake while it is current
     (`IDEAL_TEXT_FEEDBACK_BAKE_ENABLED`, default on,
     `backend-cursor/config.py:179`). Every live read writes a new bake
     (`backend-cursor/services/ideal_text_feedback_bake.py:250-287`,
     `_backfill`).
   - A bake goes stale only on the speaker's own writes: decisions,
     suggestion taps and the two answer routes
     (`ideal_text_feedback_surface_touched_at_v1`, migration 0351,
     `backend-cursor/migrations/the_bake_knows_about_answers_and_its_own_start.sql:59-87`).
   - A coach's share writes `exercise_coach_requests`, which is not on that
     list. So after the speaker's last answer, the coach's later words, and
     a coach's shared exercise too, stay off the speaker's page until the
     speaker writes something again.
   - Fix either way: count `exercise_coach_requests.shared_at` in the
     staleness function (a reviewed migration), or annotate the coach
     fields at read time.
   - Without this fix, acceptance check 1 fails whenever the bake is on.
2. **An Accept route for a coach's clearer version.**
   - None exists. `POST /v2/user/takes/<take>/feedback-response`
     (`backend-cursor/routes/v2/user_sessions.py:1443`) accepts only an item
     in the Take's frozen Feedback set, and a coach's version is not one.
   - Accept must write the new Paragraph version through the decision ledger,
     labelled "Correction accepted" (29b), as the machine's rewrite does.
   - Until it exists, a coach's version can be shown but not accepted, which
     leaves 37 and 40 open.
3. **A personal line beside a shared exercise** (coach-panel lock C1).
   - A request takes one resolution today: an exercise or words, not both.
   - If the design shows the coach's line with the coach's exercise, the
     backend must first store `answer_text` beside an exercise resolution.

### The switch

- **Backend:** none. `coach_answer` already rides every read (N45 Q7).
  `COACH_WORD_PAIRS_ENABLED = True` (`backend-cursor/config.py:428`) keeps
  the moment-line draft open.
- **Frontend:** the render lands behind one constant, off, flipped in a
  reviewed PR once the founder has signed the screen and its strings.

### Copy

Signed, and reusable as they stand:

| String | Where | Signed |
|---|---|---|
| "Your coach" | `src/components/willab/idealEditCopy.ts:139` (Step 0 title; the Exercise step's coach card) | Final Screens L6/L8 |
| "Your coach is working on your exercise." | `idealEditCopy.ts:119`; shows only while a coach is active | founder 2026-09-29; N48.3 Q10 A |
| "Clearer version" | `idealEditCopy.ts:206` | N48.3 Q8 A |
| "Accept and practise" / "Keep my words" | `idealEditCopy.ts:199-200` | N48.3 Q7 A, Q9 A |
| "Say it this way · accepted" | `idealEditCopy.ts:352` | N48.3 Q9 A |
| "Correction accepted" | `idealEditCopy.ts:283` | coach-panel lock C11 |
| "Good job", "Next", "Say it again" | `idealEditCopy.ts:107, 301, 340` | design lock; helper-words lock B9 |
| "Drafted from this Take · edit every word" (coach side) | contract 35g-8; `backend-cursor/services/coach_word_pairs.py` (`LABEL`) | 35g-8 |

- **The coach's own text** is the coach's signed words (coach-panel lock C1:
  "signed by them"). It renders as written: never edited, never summarised.
- **Still needed, to the founder:**
  - whatever tells the speaker that a line or note on the moment card is the
    coach's, if reusing "Your coach" there is not approved;
  - any label for the coach's video on a moment;
  - anything a coach's Accept says that the machine's Accept does not.

### Acceptance checks

1. **A shared praise line.** On the speaker's next read, that moment's card
   shows the coach's line. The moment is still one moment in the walk and
   the window of three is unchanged.
2. **A shared clearer version.** The card shows the coach's words under
   "Clearer version", with "Accept and practise" and "Keep my words".
   - Accept writes a new Paragraph version, History shows "Correction
     accepted", and the practise passage is the accepted text.
   - Keep my words changes nothing.
   - The next Take rewrites the Paragraph from what was said.
3. **A shared note** shows on its moment. A `video_url` plays on tap and
   never autoplays.
4. **Nothing else leaks.** Before the coach shares, nothing shows. Check the
   network payload as well as the screen for the draft, the coach's rating,
   the request's kind, the machine's read and an unshared answer: none of
   them may appear (BLIND COACH, AC-9).
5. **The coach sentence.** "Your coach is working on your exercise." shows
   only on an open error request while a coach is active, and goes once the
   coach shares.
6. **No Take-level state.** There is no "Reviewed" badge and no Take-level
   state. Recording the next Take never waits for a coach.
7. **The coach's draft.** On the coach's side, a note's Words screen fills
   with the model draft under the signed label. Saving a different final
   records one pair. A 404, 409 or 503 leaves the field empty for typing.
8. **The introduction line.** If the design shows the exercise's
   introduction, the line matches the clip's read and nothing names the
   read itself.

### Audit lines this section closes when built

- **W5, waiting for this session.** Each also needs engineering item 1, so
  that a share made after the speaker's last answer reaches the page:
  - `35g-2` (after-practice-paths), `35g-2` (contract-F2);
  - `A6`, `B3`, `C1`, `C3`, `E4`;
  - `39`;
  - `37` and `40`, which also need the Accept route above.
- **Coach side:**
  - `35g-8 (7, C5-a)` and `35g-8` (contract-F2): wire `draftMomentLine`;
  - `A3`: founder question 1.2.
- **Exercise introductions:** `P1-6d`, which also needs the founder's six
  lines in the production library.
- **Stays open after the build:** the second half of `35g-2` (contract-F2),
  "a clip the machine could not read still raises no request". It is a
  contract question, not a screen (open question 1.3).

---

## 2. Praise after practice (W11)

### What it must do

1. **The landed practice** (contract 29c; F5; N19, N22).
   - A practice ends when the speaker judges an attempt Yes or In-between
     (contract 29a; helper-words lock B6).
   - At that point, show the one sentence the backend chose about the
     attempt they landed on. It is, in order of preference:
     1. that the targeted problem cleared;
     2. else, one delivery cue that moved;
     3. else, that the attempt sounded more assured;
     4. else, "Good job."
   - An In-between gets the gentler variant. The server chooses it, so the
     screen shows `sentence` as given.
2. **Not Feedback.** It is practice feedback, not a Feedback item, with no
   budget (contract 29c, L2). It must not delay or replace the helper-words
   picker that follows (B6).
3. **A practice the speaker leaves.** Skip after at least one attempt shows
   the encouragement:
   - a real step between their tries;
   - else the effort alone.
4. **The two readings may disagree.** The sentence describes the attempt the
   speaker landed on. The scorekeeper reads the first valid attempt (F7;
   `backend-cursor/services/after_practice.py:10-14`). This disagreement is
   by design: do not make the screen "agree" with anything.

### Backend endpoints and fields

| Route | Body → answer | Code |
|---|---|---|
| `PUT /v2/user/confidence-practice/<practice_id>/attempts/<attempt_id>/answer` | `{user_answer}` → `{outcome: "again" \| "done" \| "closed", adopted, paragraph, attempt_transcript, practice}`, where `practice.after_practice` is `{key, sentence, variant: "yes" \| "in_between", lane: "cleared" \| "cue" \| "machine_leg" \| "none", rule_version, attempt_index, cue?, error?}` or `null` | `backend-cursor/routes/v2/user_sessions.py:2299-2320`; `backend-cursor/services/practice_adoption.py:163-171`; `after_practice.py:207-251, 267-270` |
| `PUT /v2/user/confidence-practice/<practice_id>/complete` | `{action: "dismiss"}` → `{practice}`, where `practice.after_practice` is `{key: "step" \| "effort", sentence, rule_version, cue?}` | `user_sessions.py:2240-2266, 1690-1697`; `after_practice.py:253-264, 290-303` |
| `GET /v2/user/confidence-practice/<practice_id>` | → the same `practice` payload, `after_practice` included | `user_sessions.py:2079`, payload `:1646-1687` |

- **The screen renders `sentence` and nothing else** from `after_practice`.
- **The frontend today:** `mapConfidencePractice`
  (`src/services/api/confidentVoicePractice.ts:114-153`) drops
  `after_practice`. Map it as `afterPractice: {sentence} | null` (wiring
  only).
- **The two moments it returns** are in
  `src/components/willab/useConfidenceExercise.ts`:
  - `finish` (judge), `:269-303`;
  - `notNow` (Skip), `:245-267`.

### Engineering this screen needs first (not a screen)

- **A Skip with no attempt must say nothing.** Today a practice opened and
  skipped before any attempt still gets the effort line, "You gave it a go.
  That counts.", because `encouragement([])` falls through to it
  (`after_practice.py:253-264`, reached from `user_sessions.py:1690-1697`).
  It would tell a speaker who never tried that they did. Contract 29c's
  "else the effort alone" presumes an attempt. Fix it in the backend before
  the switch flips.

### The switch

- **Switch:** `PRAISE_AFTER_PRACTICE_ENABLED = False`
  (`backend-cursor/config.py:374`).
- **Pinned by:** `backend-cursor/tests/test_after_practice.py:198` and
  `:329`.
- **Off:** `after_practice` is `null` and nothing is written.
- **Back on:** "when a screen ships" (config comment; N42). Flip it in one
  reviewed PR after the founder's yes.
- The same switch turns on Bold voices and the coach's readings (section 4).
  If this section ships first, Bold voices must stay unoffered by the
  screen until section 4 ships.

### Copy

- **The closed set** is `backend-cursor/services/after_practice.py:57-98`:
  - `PRAISE`: twelve keys, each a Yes and an In-between sentence;
  - `ENCOURAGEMENT`: two keys.
- **Status: to confirm.**
  - N22 records "The strings proposed on 2026-10-01 were signed off the same
    day".
  - The code comments at `after_practice.py:55` and `:93` still say
    "awaiting founder sign-off".
  - One line from the founder settles it before the flip: is this closed set
    the one the founder signed?
- **No new string is needed** if the sentence renders on its own. A
  heading, button or illustration added around it goes to the founder.

### Acceptance checks

1. **A cleared problem.** With the switch on (a test environment), judge an
   attempt Yes after a practice whose targeted problem cleared (rushing).
   - "You gave the words room this time." shows once.
   - Then the helper-words picker opens over the attempt's words, as today.
2. **In-between.** It shows the gentler variant ("A little more room
   between the words this time.").
3. **Nothing changed.** If nothing measurably changed, "Good job." shows.
4. **Skip after two attempts.**
   - If a cue moved between them: "One thing moved between your tries.
     Keep it."
   - Otherwise: "You gave it a go. That counts."
   - Skip before any attempt: nothing is said (after the fix above).
5. **Switch off.** Nothing shows, and the flow is exactly today's.
6. **Nothing else renders.** No cue name, error name, number or other
   payload field appears.
7. **The text and the loop.** The Paragraph on the page is unchanged by
   the practice (B6), and the next Take records normally.

### Audit lines this section closes when built

- `29c (F5 sentence)` and `29c (encouragement)`.
- `C29c` and `29c` (contract-F2): their praise half here, their Bold voices
  half in section 4.

---

## 3. The share switch, Lend your ear and the delayed measure (W11)

### What it must do

1. **The share switch** (contract 29d; founder determinations Q3 to Q5,
   N23; N25; signed wording
   `backend-cursor/legal/phase1-2026.1/16-share-switch-wording-SIGNED-2026-10-02.md`).
   - It sits on a Voice Album moment, one recording at a time. It is off by
     default and revocable.
   - Turning it off pulls the clip out of every pool at once: Lend your ear,
     Bold voices, and the delayed measure's pair.
   - It exists only for a speaker whose current acceptance is on policy
     version `phase1-2026-10-02` (Privacy and Terms 3.3) or later.
   - Only a moment already in the Album can be lent today (open question
     3.1).
2. **Lend your ear** (contract 29d; F3).
   - It comes after a practice that lands, at most once per Take.
   - It plays up to three short clips, audio only: no name, no words, no
     source, and never the listener's own.
   - Each clip asks the rating question with its five answers. Each person
     answers each clip once.
   - Nothing is revealed after an answer: no machine read, no other
     answers, no "right answer" (contract 35, 35f-1).
   - Fewer than three clips: show what exists. None: skip the bridge and the
     step.
3. **The bridge** is the after-practice step that leads into Lend your ear
   (`backend-cursor/services/bold_voices.py:11-23`, `STEPS`). It is shown
   at most once per Take.
4. **The delayed measure has no screen of its own** (contract 29e;
   `backend-cursor/docs/MEASURE-exercise-human-delayed-v1.md`).
   - Its pairs enter Lend your ear seven days after the practice closes, as
     separate, unlabelled clips, never both in one set.
   - The screen must not tell them apart from any other clip.
5. **A listener's answer is the listener's own data** (Q5). It is kept with
   their account, included in a copy on request, and deleted with the
   account. See the engineering list below.

### Backend endpoints and fields

| Route | Body → answer | Code |
|---|---|---|
| `PUT /v2/user/voice-album/<snippet_id>/share` | `{shared: true \| false}` → `{snippet_id, shared}`; 404 while the lane is off or the moment is not theirs; 409 `TERMS_REACCEPT_REQUIRED`; 409 `NOT_IN_ALBUM` | `backend-cursor/routes/v2/lend_your_ear.py:34-45`; `backend-cursor/services/lend_your_ear.py:60-109` |
| `GET /v2/user/takes/<take>/lend-your-ear` | → `{set_id, clips: [{clip_id, audio_ref, duration_ms, answered}]}`, the same set on every read; 409 `NOT_YET` before a landed practice; 404 off | `lend_your_ear.py` (routes) `:48-58`; services `:223-274` |
| `POST /v2/user/lend-your-ear/<set_id>/answers` | `{clip_id, value: "yes" \| "in_between" \| "no" \| "not_sure" \| "audio_unclear"}` → `{recorded, answered, of}`; 409 `ALREADY_ANSWERED` | routes `:61-72`; services `:277-318` |
| `POST /v2/user/takes/<take>/after-practice-step` | `{step: "bridge" \| "lend_your_ear" \| "bold_voices"}` → `{recorded}`, true the first time only | `backend-cursor/routes/v2/after_practice.py:45-53`; `bold_voices.py:80-93` |

- **The clients and BFF routes already exist:**
  - clients in `src/services/api/afterPractice.ts`:
    - `openLendYourEar`, `:143`;
    - `answerLendYourEar`, `:147-157`;
    - `setVoiceAlbumShare`, `:159-168`;
    - `reportAfterPracticeStep`, `:120-129`;
  - BFF routes:
    - `src/app/api/v2/user/lend-your-ear/[setId]/answers/route.ts`;
    - `src/app/api/v2/user/takes/[takeSessionId]/lend-your-ear/route.ts`;
    - `src/app/api/v2/user/voice-album/[snippetId]/share/route.ts`.
  - No screen imports them yet.
- **The Voice Album screen** is `src/app/voice-album/page.client.tsx` and
  `src/components/willab/VoiceAlbumMoment.tsx`. Its read is
  `GET /v2/voice-album` (`backend-cursor/routes/v2/arcs.py:410`).
- **`answered` and `of` are progress, not a result.** They may drive a step
  indicator, like the walk's "moment 1 of 4". They must never read as a
  score.
- **`after-practice-step` is gated on the praise switch.** It answers 404
  while `PRAISE_AFTER_PRACTICE_ENABLED` is off, because it shares
  `bold_voices._enabled()`. The bridge's once-per-Take receipt therefore
  needs section 2's switch on too.

### Engineering this screen needs first (not screens)

1. **The switch's current state.** The Album read returns no `shared` flag
   per moment, so the switch cannot show whether it is on. It needs an
   owner-only read of `voice_album_shares` / `shared_clips_live`.
2. **Practice-attempt moments.** An Album moment that is a practice attempt
   (`practice:<id>`) cannot be lent: the share route takes a snippet id
   only.
3. **Listener answers in the data export** (Q5). The automated export
   leaves them out. N24 item 6 also asks that a listener's copy never
   names the speaker, and the speaker's never names the listener
   (Article 15(4)). Both must hold before the lane flips.
4. **The version gate** compares version strings, not activation dates
   (`lend_your_ear.py:60-77`; W11 Q4/N25-1).
5. **Policy 3.3.** Confirm with the founder that `phase1-2026-10-02` was
   published and is being re-accepted. The signed record still says "not
   yet run" in its status line (record 16).
6. **The licensed corpus has no coach screen** for filing and labelling
   clips (W11 `29d (licensed corpus)`). The routes exist
   (`backend-cursor/routes/v2/lend_your_ear.py:75-106`):
   - `GET` and `POST /v2/coach/licensed-clips`, the `POST` multipart with
     `licence`, `passage` and `media_file`;
   - `PUT /v2/coach/licensed-clips/<clip_id>/label` with
     `{value: "yes" | "no" | null}`.

   The nearest built pattern is #612's training-corpus workbench
   (`src/app/coach/corpus/page.client.tsx`): an import, then labelling on
   the Judge screen. A licensed clip's label is a plain Yes or No, not the
   five answers, so it is not the same instrument.

### The switches

| Switch | Value | Where |
|---|---|---|
| `PEER_LANE_ENABLED` | `False` | `backend-cursor/config.py:390` |
| `DELAYED_MEASURE_ENABLED` | `False` | `config.py:400` |
| `PEER_SHARE_POLICY_VERSION` | `"phase1-2026-10-02"` | `config.py:409` |

- **Pinned by:** `backend-cursor/tests/test_lend_your_ear.py:489-490`.
- **Flip order** (record 16 §2; N24 item 5; N25):
  1. 3.3 published and re-accepted;
  2. `PEER_LANE_ENABLED`;
  3. `DELAYED_MEASURE_ENABLED`.

  Each is one reviewed PR after the founder's yes, and after these screens
  ship (N29.6).

### Copy

**Signed:**

- **The legal lines** the screens must not contradict: Privacy §3, §4b, §5
  and §7, and Terms §8 and §11 (record 16 §1). They say:
  - the clip is played "with no name, no words on screen and nothing about
    you";
  - "a listener answers one question about how assured the clip sounds";
  - the switch is "off unless you turn it on for that recording".
- **The rating question**, word for word: "Does the speaker sound confident
  here?" (`conf-q-v2`; `backend-cursor/services/state_ratings.py:91-108`;
  `src/services/api/stateRatings.ts:47`). The wording is the construct:
  changing it starts a new corpus.
- **The instrument.** A listener's answer joins the same blind quorum as a
  coach's (lane `game_peer`), so the screen uses the product's one blind
  instrument (coach-panel lock A1, B6, B9):
  - the clip, the question above and the five answers:
    `src/components/willab/coachwalk/CoachJudgeInstrument.tsx`;
  - it is the coach's Judge screen
    (`src/components/willab/coachwalk/CoachJudgeSheet.tsx`), and since #612
    the corpus workbench labels with it too
    (`src/app/coach/corpus/page.client.tsx`, around lines 1060-1087).
- **What does not carry over from the coach's instrument:**
  - its eyebrow, "Private · training · saved on tap"
    (`src/lib/willab/coachWalkCopy.ts:71`), is coach copy;
  - its keyboard shortcuts are a coach's convenience.
- **The answer words go to the founder.** The instrument shows "Yes —
  Confident", "In-between", "No — Not confident", "Not sure", "Audio
  unclear" (`ownerWording`;
  `src/components/willab/ConfidenceLabelChips.tsx:35-39`). The speaker's
  own sheet shows "Yes" and "No" since N48.3 Q8 A. Which set a listener sees
  is the founder's call.
- **Never the speaker's own-sheet question,** "Does this sound confident to
  you?": it asks about a read the speaker was shown, and a listener has been
  shown nothing.

**Still needed, to the founder:**

- the switch's label and its one-line explanation;
- the bridge's sentence;
- Lend your ear's title and one-line introduction;
- the thanks after an answer, if any;
- the message for `TERMS_REACCEPT_REQUIRED`, or a decision to route to the
  re-acceptance screens instead.

### Acceptance checks

1. **Off by default.** With the lane on (a test environment), take a speaker
   on 3.3 with an Album moment. The switch shows off by default.
   - On returns `{shared: true}`.
   - Off removes the clip from the next Lend your ear set, from Bold voices
     and from the measure, at once.
2. **The policy gate.** A speaker on an older policy is never shown a
   switch that fails silently: either no switch, or the re-acceptance path.
3. **Album moments only.** A moment not in the Album shows no switch.
4. **The bridge and the set.** After a landed practice, the bridge shows
   once per Take, then Lend your ear.
   - Up to three clips, audio only.
   - No name, no words, no source.
   - Never the listener's own clip.
5. **The answers.** The five answers under the rating question. A second
   answer on the same clip, which the server refuses with 409, is handled
   without an error screen.
6. **Too early.** Before a landed practice the step never appears; 409
   `NOT_YET` is handled silently.
7. **Blind.** After an answer nothing is revealed.
8. **Measure clips.** They look exactly like every other clip.
9. **Lane off.** No switch, no step, and a 404 is handled silently.
10. **The export.** A listener's answers appear in their own data export,
    without the speaker's identity (engineering check).

### Audit lines this section closes when built

- **The screens and the lane:**
  - `29d (F3 Lend your ear)`, `29d (share toggle)`, `29e (F4 delayed
    measure)`;
  - `C29d`, `C29e`;
  - `29d-album-share`, `29d-lend`, `29e`;
  - `Q3`, `16§2-5/N25-3`.
- **With the engineering above:** `Q4/N25-1` (the version gate) and `Q5`
  (the export).
- **Coach side:** `29d (licensed corpus)`.
- **Still open after the build:**
  - `16§1-P4b-ALBUM`, until the founder answers open question 3.1;
  - `Q6`, which has no screen and stays moot while N23 Q7 stands.

---

## 4. Bold voices (W11)

### What it must do

1. **When it shows** (contract 29c, 29d; F4; record 16 §1: "or simply
   listens to it as an example"). After the first practice in a Take ends,
   landed or not, the speaker may hear Bold voices, once per Take. In
   order:
   1. their own landed attempt;
   2. a coach's published readings;
   3. once the peer lane is on, others' clips that the quorum settled Yes,
      and licensed clips that a coach labelled Yes.
2. **Without names.** No speaker's or coach's name appears.
3. **Plays only.** Nothing is judged, nothing is counted where the speaker
   sees it, and every play leaves a "heard" receipt.
4. **The coach's side.** A coach records a reading of a passage, then
   publishes or withdraws it (W11 `29c (coach readings)`). The routes exist
   (`backend-cursor/routes/v2/coach_readings.py:34-67`); the screen does
   not:
   - `GET /v2/coach/readings`;
   - `POST /v2/coach/readings`, multipart: `passage`, `media_kind`
     (`audio` or `video`), `media_file`;
   - `POST /v2/coach/readings/<reading_id>/publish` with `{published}`.

### Backend endpoints and fields

| Route | Body → answer | Code |
|---|---|---|
| `GET /v2/user/takes/<take>/bold-voices` | → `{own: [{clip_id, practice_id, passage, audio_ref, duration_ms}], coach_readings: [{clip_id, passage, media_url, media_kind}], others: [{clip_id, audio_ref, duration_ms}], steps_shown: {bridge?, lend_your_ear?, bold_voices?}}`; 404 off, or not their Take | `backend-cursor/routes/v2/after_practice.py:34-42`; `backend-cursor/services/bold_voices.py:39-77` |
| `POST /v2/user/takes/<take>/after-practice-step` | `{step: "bold_voices"}` → `{recorded}` | `bold_voices.py:80-93` |
| `POST /v2/user/takes/<take>/bold-voices/heard` | `{clip_kind: "own_attempt" \| "coach_reading", clip_id}` → `{recorded: true}` | `bold_voices.py:101-113` |

- **The clients exist** in `src/services/api/afterPractice.ts`:
  - `fetchBoldVoices`, `:116`;
  - `reportAfterPracticeStep`, `:120`;
  - `reportBoldVoicesHeard`, `:131-141`.
- **Before others' clips can play:** `CLIP_KINDS`
  (`bold_voices.py:24`) has no kind for them, so their heard receipt is
  refused with a 400, and the client's `clipKind` union lacks it too. The
  backend and the client each need one value (engineering).

### The switches

- **Own attempts and coach readings:** `PRAISE_AFTER_PRACTICE_ENABLED`
  (`backend-cursor/config.py:374`).
- **Others' clips:** `PEER_LANE_ENABLED` (`config.py:390`). While it is
  off, `others` is always `[]`.

### Copy

- **"Bold voices"** is the founder's name for the step (contract 29c). Ask
  the founder whether it is also the title on screen.
- **A reading's `passage`** is what the coach read: the coach's words.
- **Still needed, to the founder:**
  - the step's title, if not "Bold voices";
  - its one-line introduction;
  - how "you", "a coach" and "another speaker" are labelled without names;
  - the empty state.

### Acceptance checks

1. **Once per Take.** With the switch on, Bold voices is offered once after
   the first practice in a Take ends. A later practice in the same Take
   does not offer it again (`steps_shown.bold_voices`).
2. **Order.** Own landed attempt, then coach readings, then others when the
   lane is on.
3. **Plays only.** No names, no judgement control, no count.
4. **Receipts.** Each play posts exactly one heard receipt, and nothing else
   is written.
5. **Off.** It is never offered and no request is made.
6. **A withdrawn share** is gone from `others` on the next read.

### Audit lines this section closes when built

- `29c (Bold voices)` and `16-BOLD`.
- The Bold voices half of `C29c` and `29c` (contract-F2).
- **Coach side:** `29c (coach readings)`.

---

## Open questions for the founder, before drawing

- **1.1 · Where the coach's words sit on the moment.**
  - The coach-panel lock's C3 says one card per moment, chosen by the
    matrix. Contract 35g-2 says a shared answer rides that same item.
  - For each kind, does the coach's answer take the place of the machine's
    card or sit with it?
    - a line on a praise card;
    - a version on a rewrite card;
    - a note on a practise or plain card.
  - The designer proposes; the founder signs.
- **1.2 · Coach-panel lock A3 and the note.**
  - A note has no Home screen (`coachAnswer.ts:48-52`): it rides the moment
    and is filed nowhere.
  - Either add a Home screen that only shares, or amend A3 to say a note
    has two screens.
- **1.3 · A clip the machine could not read.**
  - Contract 35g-2 lists it among the ambiguities that reach the coach.
  - Contract 24e-1, which is served, says nothing rises for it.
  - Which one stands?
- **1.4 · The six exercise introductions** (`P1-6d`).
  - Should the Exercise step show the introduction line? If yes, where?
  - If no, retire P1-6d.
  - The six lines themselves are founder content in the production library.
- **3.1 · What a listener's answer does** (`16§1-P4b-ALBUM`). Three texts
  disagree:
  - Privacy §4b (signed) says listeners' answers "help settle, together with
    a coach's, whether that moment belongs in your Voice Album";
  - the code lends only moments already in the Album;
  - contract 35 gives blind peer ratings no authority over Voice Album
    eligibility.

  The answer decides where the switch lives:
  - (A) keep the switch on Album moments, and correct §4b in the next
    policy version;
  - (B) allow lending before admission, and amend contracts 32 and 35.
- **2.1 · The after-practice sentences.** Confirm that the closed set in
  `after_practice.py:57-98` is the set signed under N22.

## Audit lines and where they stand

| Workstream | Line | Section | Waits for |
|---|---|---|---|
| W5 | 35g-2 (after-practice-paths) | 1 | designer session + backend (bake) |
| W5 | 35g-8 (7, C5-a) | 1, coach side | designer session (wire `draftMomentLine`) |
| W5 | P1-6d | 1 | designer session + founder (1.4) + founder content |
| W5 | A3 | 1, coach side | founder (1.2) |
| W5 | A6 | 1 | designer session + backend (bake) |
| W5 | B3 | 1 | designer session + backend (bake) |
| W5 | C1 | 1 | designer session + backend (bake; a line beside an exercise) |
| W5 | C3 | 1 | designer session + backend (bake) + founder (1.1) |
| W5 | E4 | 1 | designer session + backend (bake) |
| W5 | 35g-2 (contract-F2) | 1 | designer session + backend (bake) + founder (1.3) |
| W5 | 35g-8 (contract-F2) | 1, coach side | designer session |
| W5 | 37 | 1 | designer session + backend (bake; Accept route) |
| W5 | 39 | 1 | designer session + backend (bake) |
| W5 | 40 | 1 | designer session + backend (bake; Accept route) |
| W11 | 29c (F5 sentence) | 2 | designer session + founder (2.1) |
| W11 | 29c (encouragement) | 2 | designer session + founder (2.1) + backend (Skip with no attempt) |
| W11 | C29c | 2, 4 | designer session |
| W11 | 29c (contract-F2) | 2, 4 | designer session |
| W11 | 29c (Bold voices) | 4 | designer session |
| W11 | 29c (coach readings) | 4, coach side | designer session (coach screen) |
| W11 | 16-BOLD | 4 | designer session + both switches |
| W11 | 29d (F3 Lend your ear) | 3 | designer session |
| W11 | 29d (share toggle) | 3 | designer session + backend (share state) |
| W11 | 29d (licensed corpus) | 3, coach side | designer session (coach screen) |
| W11 | 29e (F4 delayed measure) | 3 | designer session (rides Lend your ear) |
| W11 | C29d | 3 | designer session |
| W11 | C29e | 3 | designer session |
| W11 | 29d-album-share | 3 | designer session + founder (3.1) |
| W11 | 29d-lend | 3 | designer session |
| W11 | 29e | 3 | designer session |
| W11 | Q3 | 3 | designer session |
| W11 | Q4/N25-1 | 3 | backend (version gate) + founder ops (3.3 publish) |
| W11 | Q5 | 3 | backend (export) + operator purge |
| W11 | 16§2-5/N25-3 | 3 | the screens, then the founder's flip |
| W11 | Q6 | 3 | none; moot while N23 Q7 stands |
| W11 | 16§1-P4b-ALBUM | 3 | founder (3.1) |
