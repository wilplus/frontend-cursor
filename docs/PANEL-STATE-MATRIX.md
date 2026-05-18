# Panel-State Matrix — `/chat` surface (v1)

**Status:** load-bearing acceptance artifact. Every prompt in the chat-refactor
sequence (FE Prompts 1–3) cites this file. Tests in FE Prompt 2 must cover
every row here.

## Pinned semantics

- **Dual-capture mic (FE Prompt 3, BE/FE stress-contrast series).** The
  small mic inside `composer` opens BOTH `SpeechRecognition` and
  `MediaRecorder` against a single `getUserMedia` stream. The Web Speech
  transcript drives the visible input field, and the raw `audio/webm;
  codecs=opus` blob ships in the multipart body of `/v2/chat/query` as
  `audio_file`. The visible string IS the message sent — backend's
  silent acoustic analysis runs on the blob but never substitutes the
  user's text. C2: the mic affordance is hidden when Web Speech +
  MediaRecorder aren't both supported (Firefox today). C6: first mic
  press shows a one-time consent modal gated by
  `localStorage["casualVoiceConsent"]`. C7: backend's optional
  `contrast` block is rendered only when non-null — absent →
  rendered nothing at all (no "not enough data" placeholder).

- **`user_label: bool` on `POST /v2/chat/snippet-followup` means AGREEMENT.**
  `true` = "I agree with the AI's classification of this snippet's
  admin_comment". `false` = "I disagree." This default holds until backend
  confirms otherwise via a one-line entry below.

  Frontend translation from the existing `/api/v2/user/snippets/<id>/label`
  endpoint (which uses `user_label: "charisma" | "stress"`):

  ```ts
  agreement = (clickedLabel === snippetType)   // both "charisma" or both "stress"
  ```

  **TODO(backend confirmation):** smoke-call `/v2/chat/snippet-followup` with
  both bool values for one snippet; if `followup_text` for `true` reads "you
  agreed with…" → confirmed. If it reads "you classified as charisma…" → swap
  semantic to TYPE and update the translation above to `clickedLabel === "charisma"`.

## Column legend

- **`primaryControl`** — what occupies the bottom toolbar slot.
  Enum: `none | composer | action_buttons | practice_cta | signup_cta |
  rating_composer`
  - `composer` is the default control on the non-recording surface
    (welcome_back / q_and_a / reviewing). Single widget — see
    `ChatInputBar` — laying out: inline paperclip (Rule G gated),
    text field, inline small mic (gated on Web Speech +
    MediaRecorder support, per FE Prompt 3 / contract C2), send
    button. The mic opens a dual-capture session: Web Speech
    transcript drives the visible input value, MediaRecorder
    captures the raw audio in parallel; on send, presence of the
    audio blob switches the wire format to multipart so backend
    BE-3 can extract silent acoustic metrics.
  - Inline paperclip — Rule G gated. NOT a separate toolbar mode;
    just a sub-field of `composer` (`showUpload: boolean`). The
    composer never disappears in favour of an "upload slot."
- **`textInputEnabled`** — is the QAInput textarea live for typing?
- **`micEnabled`** — is the microphone usable (recording will start on tap)?
- **`paperclipVisible`** — is the file-upload affordance shown?
  Rule: gated on backend `show_upload_ui` per-turn flag. Currently only the
  Q&A surface (`/v2/chat/query` response) emits this flag; the recording
  surface (`/next-question`, `/upload-answer`) does NOT. Until backend adds
  the flag to recording responses, `paperclipVisible = false` on recording
  surfaces in practice. See `TODO(backend): unify show_upload_ui across endpoints`.
- **`notes`** — known caveats, blind-spot markers, or pointers to related rows.

---

## Phase → SurfaceContext map (used by `deriveToolbar`)

```
recording      = onboarding | compiling | metrics_ask | roleplaying
non_recording  = welcome_back | q_and_a | reviewing
neither        = loading | error
```

---

## Logged-out scenarios (anonymous funnel)

| ID | Scenario | primaryControl | textInputEnabled | micEnabled | paperclipVisible | notes |
|---|---|---|---|---|---|---|
| LO-1 | Anonymous on `/chat`, first paint, auth probe resolves to anonymous | `composer` | false | true (after `currentQuestion` lands) | false (backend gate, recording surface) | GDPR disclaimer shown turn 1 only |
| LO-2 | Anonymous still recording, between turns, upload in flight | `none` (recording branch falls through) | false | false (`isLoadingQuestion`) | false | TypingBubble in thread |
| LO-3 | Anonymous, 30s threshold fires → phase=compiling | `none` | false | false (`thresholdReached`) | false | TypingBubble in trailingBubbles |
| LO-4 | Anonymous, phase=metrics_ask, metricsSnapshotReady | `signup_cta` | false | false | false | [Sign up to receive your analysis] button |
| LO-5 | Anonymous clicks Sign Up → external OAuth | n/a (out of app) | n/a | n/a | n/a | `STATUS: known limitation` — recording thread is LOST across the OAuth hop. localStorage carries pending session id + welcome flag only. Anonymous-thread persistence is out of scope. |

## Logged-in scenarios

| ID | Scenario | primaryControl | textInputEnabled | micEnabled | paperclipVisible | notes |
|---|---|---|---|---|---|---|
| LI-1 | Signed-in user lands on `/chat` (no_session) | `composer` | false | true (after `currentQuestion` lands) | false | Same as LO-1 minus GDPR disclaimer |
| LI-2 | Signed-in, `/chat?session=<id>`, status=processing | `composer` (inline paperclip on show_upload_ui) | n/a (voice-first; text input is unsupported-browser fallback inside MicButton) | true (mic ready) | per-turn override | Pending-greeting bubble; polling every 5s |
| LI-3a | Polling sees `completed` → phase=reviewing, fetch in flight | `composer` | n/a | true | per-turn override | Transition is silent (no bot announcement) — see `BS-1` blind spot |
| LI-3b | Reviewing fetch lands, snippet 1 + action_pending appear | `composer` (with inline YES/NO inside ActionBubble) | n/a | true | per-turn override | Inline action_pending bubble carries the YES/NO buttons; mic stays so the user can voice-Q&A in parallel |
| LI-4a | User clicks YES/NO → label POST in flight | `composer` (qaSubmitting=true → mic + send disabled) | n/a | false (locked during chain) | per-turn override | Optimistic echo bubble with `pending: true` |
| LI-4b | Label POST 200 → echo bubble commits, snippet-followup POST in flight | `composer` (still disabled via qaSubmitting) | n/a | false | per-turn override | TypingBubble appended; awaiting `/v2/chat/snippet-followup` response |
| LI-4c | Snippet-followup 200 → followup_text bubble appended | `composer` | n/a | true | per-turn override | `pendingFollowUp` routes the next mic transcript to the thread-local handler, NOT `/chat/query` |
| LI-4d | User voice-replies to followup → user_text + bridge bubbles appear → next snippet reveals | `composer` (next snippet's action_buttons live inline in ActionBubble) | n/a | true | per-turn override | Bridge string rotates by snippet index |
| LI-5 | All snippets resolved (state === "answered" for every snippet) | `practice_cta` | false | false | false | [Start practice (2 min)] button |
| LI-6 | User taps practice CTA → phase=roleplaying | `composer` | false | true | false (backend gate) | Same-mount transition. Thread persists per FE Prompt 1. |
| LI-7 | Roleplay, recording in progress | `composer` | false | true | false | Same as LO-1 mechanics, 120s cap |
| LI-8 | Roleplay finalize → router.push to `/chat?session=<new-id>` | n/a (page remount) | n/a | n/a | n/a | `STATUS: known limitation` — thread RESETS across the navigation. Cross-mount continuity is out of scope for this PR. |
| LI-9 | Welcome_back (post-signup return) | `none` | false | false | false | 400ms read-only window; two welcome bubbles seeded; auto-transitions to LI-10 |
| LI-10 | Q&A phase, post-welcome OR pending-processing | `composer` | n/a | true | per-turn override | Same as LI-2 mechanically |
| LI-11 | Signed-in user with completed session lands on `/chat?session=<id>` | `composer` then inline `action_buttons` (race-fast) | n/a | true | per-turn override | Pending-greeting fires for ~5s before polling catches up. See `BS-2`. |

## Rating-phase scenarios (post-upload self-rating)

| ID | Scenario | primaryControl | textInputEnabled | micEnabled | paperclipVisible | notes |
|---|---|---|---|---|---|---|
| RA-1 | Backend's upload-answer returns `requires_self_score: true` | `rating_composer` | false | false | false | 1-10 button row replaces mic |
| RA-2 | User taps a rating → POST in flight | `rating_composer` (submitting) | false | false | false | Loader on the selected button |
| RA-3 | Rating POST resolves → return to mic | `composer` | false | true | false | Next question lands |

## Cross-mount / boundary transitions

| ID | Transition | Expected behavior | Notes |
|---|---|---|---|
| TX-1 | `reviewing → roleplaying` (same mount via `setPhase`) | **Thread PERSISTS.** All prior bubbles (dashboard, snippet+action pairs, user-text echoes, bridge bubbles) remain visible. Roleplay's new bot questions + user audio append to the same array. | This becomes possible after FE Prompt 1 lifts the messages array to ChatPageClient. Acceptance criterion for that PR. |
| TX-2 | Roleplay finalize → `router.push('/chat?session=<new-id>')` | **Thread RESETS.** New page mount, new array. | `STATUS: known limitation`. Cross-`router.push` continuity requires either replacing the navigation with in-place state updates OR persisting the array to a store. Out of scope. |
| TX-3 | Anonymous metrics_ask → click Sign Up → OAuth → return to `/chat` | **Recording thread RESETS.** localStorage carries pending session id + welcome flag; the recording bubbles themselves are lost. | `STATUS: known limitation`. Anonymous-thread persistence is out of scope. |

## Error / edge scenarios

| ID | Scenario | primaryControl | textInputEnabled | micEnabled | paperclipVisible | notes |
|---|---|---|---|---|---|---|
| EF-1 | Reviewing fetch returns zero snippets | `composer` | n/a | true | per-turn override | "No snippets came through" bubble. `[Start practice]` never appears. User stuck unless they voice-Q&A. `STATUS: blind_spot` — needs explicit decision: should there be a "record another session" recovery affordance here? **Decision pending.** |
| EF-2 | Label POST returns 5xx | `mic` (inline `action_buttons` stay clickable for retry) | n/a | true | per-turn override | Bubble keeps `submitting: false`, no `pending` flag, `errored: true`. Buttons stay clickable for retry. Toast/inline error required. `STATUS: blind_spot` — currently silent failure. **Decision needed:** inline error bubble vs toast. |
| EF-3 | `/v2/chat/query` returns 5xx | `composer` | n/a | true | reset to false | Inline "Couldn't reach the coach" bubble (split per Rule F). No retry affordance — user re-speaks. |
| EF-4 | `/v2/chat/snippet-followup` returns 5xx | `composer` | n/a | true | per-turn override | Static fallback bubble ("Noted — let's keep going.") replaces the typing bubble. Skip directly to `answered`, reveal next snippet. User never gets stuck. |
| EF-5 | Refresh mid-reviewing, some snippets already labelled | `action_buttons` (snippet 1, again) | true | false | gated | `STATUS: known limitation`. Backend doesn't return per-snippet user-labelled state; user must re-label. Captured for future phase. |
| EF-6 | Mobile Safari background tab, polling throttled | n/a | n/a | n/a | n/a | `STATUS: blind_spot` — no resume-on-visibility-change handler. User comes back to stale chat. **Decision needed:** add `visibilitychange` listener to re-probe immediately? |
| EF-7 | Network drops mid-recording, upload-answer fails | error state in ChatInterview | false | false | n/a | Existing `GuestUploadFailure` handling. Setting error message bubble. |

## Blind spots requiring human triage before FE Prompt 2 tests are written

These rows reference behavior that hasn't been decided. They MUST be resolved
before Prompt 2 unit tests are authored — otherwise the tests lock in
whatever the agent guessed.

- **`BS-1` — Reviewing transition feedback:** When polling promotes
  `q_and_a → reviewing`, should the bot emit an announcement bubble
  ("Your snippets are ready ✨") before the fetch lands? Today: silent.
- **`BS-2` — Pending-greeting on already-complete session:** When a user
  lands on `/chat?session=<id>` for a session that's already in `completed`
  state, the pending-greeting bubble fires briefly before polling catches up
  and transitions to reviewing. The greeting is technically wrong ("snippets
  haven't arrived yet" when they have). Skip the greeting?
- **`EF-1` — Zero-snippet dead end:** see row.
- **`EF-2` — Label POST failure UX:** see row.
- **`EF-6` — Background tab resume:** see row.

## Paperclip rule (cross-cutting)

- HIDDEN by default everywhere. Revealed only when the backend's most-recent
  response to that surface carried `show_upload_ui: true`.
- Q&A surface (`/v2/chat/query`): backend ships the flag today. Working.
- Recording surface (`/next-question`, `/upload-answer`): backend does NOT
  currently ship the flag. Effectively false until they do.
  `TODO(backend): add show_upload_ui to next-question + upload-answer responses`.
- Visual model on the non-recording surface (post FE Prompt 3): the
  paperclip is INLINE inside `composer` (`ChatInputBar`), positioned to
  the left of the text field. Not a separate toolbar slot — the
  composer (and its dual-capture mic) stays mounted continuously.
- ChatInterview's paperclip toggle remains a SWAP (mic → dropzone). The
  recording-surface paperclip-unification work is queued for Phase 1b
  alongside the rest of the ChatInterview lift.

## Endpoint preconditions (FE Prompt 0 verification)

- **`POST /v2/chat/snippet-followup`** — verified shipped by backend Prompt 0.2.
  Smoke contract:
  ```
  POST /v2/chat/snippet-followup
  Authorization: Bearer <JWT>
  Body: { snippet_id: uuid, user_label: bool }
  Response 200: { followup_text: string (non-empty), debug: object }
  ```
  Smoke script: `scripts/smoke-snippet-followup.sh` (TODO: add when backend
  smoke env is available).

- **`POST /v2/chat/query` — multipart branch (BE-3, stress-contrast series).**
  Frontend ships the multipart wire format the moment the dual-capture
  mic is used; backend BE-3 must accept the `audio_file` part and
  optionally return a `contrast: { samples, deltas }` block. As of FE
  Prompt 3 commit, backend HEAD on `backend-cursor` is
  `9ddd2f2 feat(panel/BE-0):` — BE-3 is NOT shipped. Until it lands the
  multipart branch will 4xx; the JSON branch (typed-only sends) is
  unaffected per contract C1. Verify post-deploy by issuing a
  multipart POST against the staging URL.
