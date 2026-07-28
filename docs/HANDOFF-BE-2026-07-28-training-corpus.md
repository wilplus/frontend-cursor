# BE handoff — Training corpus (FE side is live on `main`)

**From:** frontend-cursor · **Date:** 2026-07-28 · **FE commit:** `8f6e77f`
**Status:** built against `feat/training-corpus` (`cde9abb`) exactly as specced. No
contract changes requested. One real risk to resolve together (§1), a few things to
confirm, and the founder's answers to the three open questions.

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

### 3a. `idempotency_key` — what it means and what it asks of you

A form field, not a header, so it needs no proxy change and travels like every other
import parameter.

**It is derived, not generated.** A fresh uuid per attempt would have been useless: a
retry is by definition a new attempt, so it would get a new uuid and dedupe nothing.
The key is a truncated SHA-256 of the file's identity plus the metadata it is being
filed under: `name`, `size`, `lastModified`, trimmed `topic`, trimmed `speaker_label`,
NUL-joined. It is hashed rather than sent raw so filenames stay out of request logs.

What that buys, concretely:

- **Same file re-picked and re-imported → same key.** This is the case that matters:
  the proxy times out, the coach presses Import again, and the second request carries a
  key you have already seen. Proven in a browser test, not asserted — `e2e/corpus.spec.mjs`
  fails the run if a retry's key differs from the first attempt's.
- **Two files in one batch → different keys**, including same-name-different-size.
- **A rename, a different topic, or a different speaker → a new key.** Deliberate: that
  is a second filing of the same audio, not a retry, and you should let it through.

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

## Where to verify

`e2e/corpus.spec.mjs` (26 checks) runs against `src/app/dev/corpus/page.tsx`, which
stubs all three endpoints in the exact shapes above — useful as an executable example
of what the FE expects and sends. Mapper and its degradation rules:
`src/services/api/trainingCorpus.ts`.
