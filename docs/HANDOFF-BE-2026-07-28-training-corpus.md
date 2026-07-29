# BE handoff — Training corpus (FE side is live on `main`)

**From:** frontend-cursor · **Date:** 2026-07-28, **updated 2026-07-29** ·
**FE commit:** `132b464` + the language picker
**Status:** built against `feat/training-corpus` (`cde9abb`) exactly as specced. No
contract changes requested. Below: one real risk to resolve together (§1), a few things
to confirm, and the founder's answers to the three open questions.

> **Read §7 first.** The first real import ran on 2026-07-29 and came back
> **`ok: true` with zero pieces and no session row** — a Polish talk. That is a live
> blocker. Part of it was ours — nothing sent a language hint — and the FE now sends
> `language` with a picker on the import panel. **We still need you to confirm you read
> that field**, and to stop returning `ok: true` for an import that produced nothing.

---

## 1. ⚠️ The import will time out at the proxy long before the BE finishes

**This is the one thing that needs a decision before a real 30-file batch.**

The import is a single request that runs Whisper plus the cutting pass inline — minutes
on a long talk, by your own description. It reaches the BE through a Next.js route
handler, which has a **platform-imposed** maximum duration. I declared
`maxDuration = 300` on it, but that number is aspirational: **nothing else in this
frontend has ever exceeded 60**, and 27 of the 37 API routes sit at 30. An existing
route even documents the ceiling in a comment — *"our 25s inner abort fired before
Vercel's 30s"*. If the deploy tier caps below 300, my declaration is silently clamped
and a long import dies at the gateway.

**The failure mode is worse than a slow screen.** The proxy returns a timeout while
the BE keeps working and very likely **succeeds**. The coach sees "failed", re-imports
the same file, and the corpus gets a duplicate — the same talk twice, both labelled,
both training. Corpus pollution is much harder to notice and undo than a failed upload.

Three ways out, cheapest first:

1. **Confirm the real ceiling and the real wall time.** If a 45-minute talk finishes in
   under the cap, nothing to do — tell me the number and I will set the FE budget to
   match and stop worrying.
2. **Cap the input instead.** If a file over ~N minutes reliably exceeds the cap, say so
   and the FE will refuse it up front with "split this into parts" — an honest limit
   beats a silent duplicate.
3. **Make the import async.** `POST` returns `202 { job_id }` immediately; the FE polls
   for status. More BE work, but it is the only option that scales to hour-long
   archive material, and it makes a duplicate structurally impossible (the job id is
   the idempotency key).

**The FE has now taken the cheap half of this unilaterally: every import carries an
idempotency key.** It does not fix the timeout — only you can do that — but it means a
timeout can no longer silently duplicate the corpus, *provided you dedupe on it*. See
§3a for the exact semantics. **Until the BE honours the key, the duplicate risk is
still live**; the FE is simply now sending everything you need to close it with a
unique index.

---

## 2. `audio_ref` on the queue must be a resolved, playable URL

The labelling screen is a *listening* screen: the coach plays the piece, reads the
words, then judges. The FE puts `audio_ref` straight into an `<audio src>` and clamps
playback to `start_offset_ms` / `duration_ms`.

So it needs to be a **public or signed URL**, not a storage key or bucket path. If it
arrives as a key the player renders disabled and the whole surface degrades to reading
transcripts — which is not labelling confidence, it is labelling text. (Same lesson as
the star-review payload, where the five audio fields had to be added deliberately.)

Worth confirming, since the spec says only "play this".

---

## 3. What the FE sends — so nothing surprises you

**Import** (`POST /v2/coach/training-imports`, multipart, one file per request,
**sequential** across a batch — proven in a browser test, not assumed):

| Field | Always sent? | Note |
|---|---|---|
| `audio_file`, `topic` | yes | topic is required by the UI too |
| `stages` | yes | **always begins with `confidence`** — the UI cannot omit it; the value is `"confidence"`, or `"confidence,analytics"` etc. Never empty, never without it. |
| `speaker_label`, `note` | when filled | the speaker nudge from the spec is on screen |
| `user_id` | **never** | defaults to the uploading coach, as specced |
| `queue_per_band` | **never** | your default of 5 stands. Not exposed in the UI yet — say if a coach should be able to raise it per import. |
| `idempotency_key` | **yes, always** | new — see §3a. Lowercase hex, 16 or 32 chars, never empty. |
| `language` | **only when the coach picks one** | new — ISO-639-1 (`pl`, `en`, …). **Omitted entirely on auto-detect**, which is the default, so the request a coach who ignores the picker sends is byte-identical to what shipped before it existed. Never sent empty. See §7. |

### 3a. `idempotency_key` — what it means and what it asks of you

A form field, not a header, so it needs no proxy change and travels like every other
import parameter.

**It is derived, not generated.** A fresh uuid per attempt would have been useless: a
retry is by definition a new attempt, so it would get a new uuid and dedupe nothing.
The key is a truncated SHA-256 of the file's identity plus the metadata it is being
filed under: `name`, `size`, `lastModified`, trimmed `topic`, trimmed `speaker_label`,
**and `language`** — NUL-joined. It is hashed rather than sent raw so filenames stay
out of request logs.

`language` is in the key deliberately, and it matters to you: the first thing a coach
does after an empty import is re-import the same file with the language corrected. If
language were not in the key, that retry would be byte-identical to the failed run,
**your dedupe would hand back the empty original, and the fix would look like it did
nothing.** A different language is a different analysis — please treat it as one.

What that buys, concretely:

- **Same file re-picked and re-imported → same key.** This is the case that matters:
  the proxy times out, the coach presses Import again, and the second request carries a
  key you have already seen. Proven in a browser test, not asserted — `e2e/corpus.spec.mjs`
  fails the run if a retry's key differs from the first attempt's.
- **Two files in one batch → different keys**, including same-name-different-size.
- **A rename, a different topic, a different speaker, or a different language → a new
  key.** Deliberate: that is a second filing of the same audio, not a retry, and you
  should let it through.

**What the FE cannot promise:** identity is `(name, size, mtime)`, *not* the bytes.
Hashing content would mean reading thirty 50 MB files into memory twice for a property
this problem does not need. So two genuinely different files that share all three
fields would collide — vanishingly unlikely from a real folder, but it is the reason
the key is a dedupe hint and not a content address.

**The ask:** treat `(coach_id, idempotency_key)` as unique. On a repeat, return the
**original** import's result (`200` with the same `session_id`) rather than starting a
second Whisper run — the coach then sees the import they thought had failed, which is
the truth. Second best is a `409` the FE can render. Ignoring the field is also safe:
nothing breaks, you simply keep the duplicate risk in §1. Tell me which you chose,
because "it succeeded" and "it was already done" should probably read differently on
screen, and today they would read the same.

**Label** (`PUT /v2/coach/snippets/<id>/confidence-label`):

- `confident` is always a real JSON boolean — the body builder **refuses** to construct
  anything else, so `"true"` can never leave the FE.
- `intensity` is sent only as an integer 1–5. Out-of-range is **dropped, not clamped** —
  a clamped 9 would silently become a 5 nobody picked.
- `note` is accepted by the builder but **the UI has no note field yet**, so it is never
  sent today. Tell me if the corpus wants per-label provenance and I will add it.
- Yes/No saves on its own (one PUT); picking a grade re-sends the same answer with the
  intensity (a second PUT). So **two writes for a graded piece** — the upsert semantics
  in your spec make that safe, but worth knowing when reading write volume.

---

## 4. The founder's answers to your three open questions

1. **Where the coach reaches it** → its own **"Training corpus"** row in the hamburger,
   opening `/coach/corpus`. Coach-only: the row exists only for a coach, and the page
   renders nothing for a non-coach who types the URL. (Your role gate upstream is still
   the authoritative one; the FE gates are for the person who guesses.)
2. **All copy** → written, and flagged for founder sign-off. Nothing is locked.
3. **May a coach label their own students' real takes through this screen?** →
   **No — imports only.** The labelling screen is reachable only from an import row.
   Your endpoints still allow any session id; the UI simply never offers one.

   Consequence worth holding on your side: **the corpus is made entirely of imported
   outside speech.** No student take enters it through this surface, so the corpus and
   the blind direction-labelling lane stay disjoint — the same coach never gives both a
   blind direction label and a confidence label on the same audio. If that changes, it
   is a one-line UI change here, but it changes what the corpus *is*.

---

## 5. What this FE will never render (fences, enforced by a test)

`src/app/coach/corpus/corpusFence.test.ts` fails the build if any of these break, so
these are guarantees rather than intentions:

- **N1** — the corpus service and the labelling screen may not import the lanes that
  carry a machine confidence read (`starVerdicts`, `readout` where `power_score` lives,
  `coachReview` where the acoustic needle lives) **at all** — not even for a type. The
  screen's code may not contain band/score vocabulary. The dev harness deliberately
  **serves** a `band` and a `confidence_score` on every queue piece so a leak fails a
  browser test rather than shipping.
  → You can add fields to the queue payload safely; the FE maps only what it needs and
  drops the rest. But please keep the payload free of the read anyway — a field that
  exists is a field someone eventually renders.
- **N2** — payload order is preserved. Nothing sorts, groups or re-keys the queue.
- **N3** — no default answer, no pre-selection, and the 1–5 row does not exist until
  Yes or No is picked.
- **N4** — no user-reachable entry point; the test asserts every link site gates on
  `isCoach`.
- **FE-4/N5** — the test also asserts the normal user's upload path carries no stage
  vocabulary, so stages cannot leak onto the record flow by a later edit.

---

## 6. Migrations (unchanged, listing for completeness)

- `migrations/add_confidence_labels.sql` — until it runs, the label PUT 500s and the FE
  shows the message verbatim; the queue still loads and plays.
- `migrations/add_admin_import_fields_to_recordings.sql` — imports work without it but
  lose provenance (`speaker_label` etc.).

---

## 7. ⚠️ FIRST REAL IMPORT CAME BACK EMPTY (2026-07-29) — needs your eyes

The founder ran the first real import. It reported **success and produced nothing.**
This is the live blocker; everything above is theory next to it.

**What was imported:** a conference talk, **in Polish** — file
`Przemysław Paczek, Prezes i Założyciel Nevomo.mp3`, topic *"thank you talk at the
conference"*, speaker *"przemysław pączek"*, stages `confidence` only.

**What came back**, read off the two things the screen renders:

1. `POST /v2/coach/training-imports` → **2xx with `ok: true`** and
   **`snippet_count: 0`, `queue_count: 0`**. (That line cannot render otherwise — the
   FE treats a missing or non-`true` `ok` as a failure and shows your error instead.)
2. `GET /v2/coach/training-imports` — a **separate** request, made right after — came
   back fine and listed **zero rows**. The screen said "Nothing imported yet", which is
   the empty state; a failed load says "Couldn't load the corpus just now".

So this is not one bad counter. **No session was written that the coach can open at
all.** Whatever happened, it happened before anything durable was created.

### What we think it is, most likely first

1. **Language.** The talk is Polish. If Whisper is pinned to English (or defaults to
   it), the transcript comes back empty or as garbage, and a cutter with nothing to cut
   returns exactly this shape: accepted, `ok`, zero pieces, nothing worth persisting.
   **See the gap below — this may be our fault, not yours.**
2. **The cutter found no candidates.** A calm thank-you talk may simply clear no
   threshold. That is tuning, not a bug — but it should not report as success, and
   ideally it should say so in `reason`.
3. **The file was never decoded.** An mp3 the decoder could not read. The duration
   distinguishes this from 1 and 2 instantly (below).

### The gap that was ours: no `language` field — now closed on this side

When this import ran, **nothing anywhere sent a language hint.** The FE sent
`audio_file`, `topic`, `speaker_label`, `note`, `stages`, `idempotency_key` — that was
the complete list, and there was no UI to give one either. So if the import path needs
telling, **it had never been told, by anyone, since this shipped**, and every
non-English import would behave exactly like this one.

**The FE now sends `language`.** There is a picker on the import panel, under the
speaker field, and the field is ISO-639-1 (`pl`, `en`, …).

Two properties chosen so this cannot make anything worse while you decide:

- **Auto-detect is the default and omits the field entirely** — not an empty string, no
  field at all. A coach who never touches the picker sends a request byte-identical to
  the one that worked before, so the picker cannot break an import for you, and it
  cannot break one if you ignore the field.
- **Only codes on the menu are sent.** An unrecognised code is dropped back to
  auto-detect rather than forwarded, because an unknown code either 400s at your end
  or — worse — transcribes the talk as the wrong language.

If you want a different field name, a locale instead of a bare code, or a header, say
so; it is a one-line change here.

### What the FE changed on its side (`132b464`, then the language picker)

A zero-piece import no longer renders as a success. It is now its own outcome — amber,
neither the grey of a good import nor the red of a rejection — reading
**"Read 41 min — but 0 pieces, nothing to label"**. It is terminal: pressing Import
again skips it rather than spending a second inline Whisper pass on the same answer.

Crucially, **`duration_sec` is now shown**, and it is the whole diagnosis:

| Re-import shows | Meaning |
|---|---|
| the real length (~41 min) | audio decoded fine → transcription or cutting is the problem (cause 1 or 2) |
| `0` or absent | the file was never decoded (cause 3) |

The FE had always received `duration_sec` and discarded it, which is why the first
report of this could not be narrowed without DevTools. Fixed.

### What we would like from you

1. **Run that file yourself** and say which of the three it is. The duration on a
   re-import narrows it to one line of your code.
2. **Confirm the import path reads `language`.** The FE now sends it — we need to know
   you consume it, and whether you want an explicit code, or auto-detect with the code
   as an override. Until you confirm, the picker is a promise the FE cannot keep.
3. **Do not return `ok: true` for an import that produced nothing.** A zero-piece
   result is a failure of the thing the coach asked for, and the FE can only be as
   honest as the payload. Either a non-ok with a `reason` we render verbatim
   (`NO_SPEECH_DETECTED`, `NO_CANDIDATES`, `LANGUAGE_UNSUPPORTED` — any code is fine,
   we show your text), or keep `ok: true` and add a `reason`; we will surface it. The
   current shape makes "worked perfectly" and "silently did nothing" identical on the
   wire.
4. **Say whether a zero-piece import should write a session row.** Today it seems not
   to, so there is nothing to re-open or inspect. We think not writing one is right —
   but then the POST response is the coach's only record, which is another reason it
   needs to carry a reason.

Reproducible without the BE: `src/app/dev/corpus/page.tsx` serves this exact payload
(`ok: true`, `duration_sec: 2480`, zero pieces) for any file named `*empty*`, and
`e2e/corpus.spec.mjs` fails if it ever reads as a success again.

---

## Where to verify

`e2e/corpus.spec.mjs` (35 checks) runs against `src/app/dev/corpus/page.tsx`, which
stubs all three endpoints in the exact shapes above — useful as an executable example
of what the FE expects and sends. Mapper and its degradation rules:
`src/services/api/trainingCorpus.ts`.
