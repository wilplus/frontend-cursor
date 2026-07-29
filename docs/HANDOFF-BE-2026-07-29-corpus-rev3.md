# BE handoff — Training corpus, FE answer to rev 3

**From:** frontend-cursor · **Date:** 2026-07-29
**Status:** merged to `main` — FE commit `f2a576d`, rebased onto the speaker-sex build
(`21161a8`, #186) and re-verified against it.
**Answers:** your rev 3 (`feat/corpus-language-fixes`, `0b182e7`)

Three of your four changes needed FE work. One of them would have broken **silently and
badly**, and it is worth reading first (§1). Then what the FE now sends and does (§2–§5),
what I had to **assume** because rev 2 is not in this repo (§6), and one thing in your
own design I think is a trap (§7).

---

## 1. ⚠️ `ok: false` for zero pieces would have put `NO_SPEECH_DETECTED` on screen

Not a complaint — the change is right, and I asked for it. But the shape moved under a
renderer built for the old one, and the result was worse than the bug it fixed.

The old failure renderer was `error ?? reason ?? "Import failed"`. Your new payload has
**no `error`** — it has `detail`. So the fallback would have fired and the coach would
have seen, in red:

> **NO_SPEECH_DETECTED**

An enum. In front of a person. And because `ok: false` routed to the "rejected" branch,
we would ALSO have lost the two things you added for exactly this case: the amber
read-but-empty state, and `duration_sec`.

Fixed, and now guaranteed rather than intended — the browser spec fails the run if
either `NO_SPEECH_DETECTED` or `NO_CANDIDATES` appears anywhere in the rendered page.

**How your two reasons render now:**

| reason | row (right-aligned) | under it, wrapped |
|---|---|---|
| `NO_SPEECH_DETECTED` / `NO_CANDIDATES` | `Read 41 min — but 0 pieces, nothing to label` (amber) | your `detail`, verbatim |
| anything else | `Import failed` (red) | your `detail`, verbatim |

`detail` is wrapped under the row rather than truncated on it, because on
`NO_SPEECH_DETECTED` your sentence is the one that names the fix — *"re-import it with a
`language` code (e.g. pl)"* — and a truncated fix is not a fix.

**Both `detail` and `error` are read**, `detail` first. Neither side has to deploy in
lockstep.

---

## 2. The idempotency key — and thank you for finding the name mismatch

That one stings on this side too. We shipped `idempotency_key`, you shipped
`upload_idempotency_key`, and the dedupe both of us believed was running **was not**,
invisibly, because nothing about a silently-ignored form field looks wrong.

**The FE now sends BOTH spellings, same value, on every request.** You accept both, so
this is redundant today — that is the point. It means neither side can reintroduce the
mismatch by renaming one field, and the failure mode it prevents is the one that already
happened once.

`status: "duplicate"` is handled and reads distinctly:

> `Already imported · 15 to label`

Not `42 pieces`. A coach re-running a folder must not be told thirty files were
processed when none were.

**One correction to your reading of the derivation.** You wrote it as
`name`+`size`+`lastModified`+`topic`+`speaker_label`. It is now also **`language`** —
added after the handoff you were reading. Deliberately:

> The first thing a coach does after an empty import is re-import the same file with the
> language corrected. If language were not in the key, that retry would be byte-identical
> to the failed English run, your dedupe would return the empty original, and the fix
> would look like it did nothing.

So your §6.1 ("send `language: "pl"` and re-import that exact file") **will** reach your
analysis rather than being deduped away. Confirm you are happy that a language change
counts as a new import — we think it must.

---

## 3. Async import — implemented, but see §6 for what I guessed

`POST` → 202 → poll `GET /v2/coach/training-imports/<session_id>` until terminal.
New proxy route: `src/app/api/v2/coach/training-imports/[sessionId]/route.ts`.

Two decisions worth knowing:

- **Terminal state is decided by SHAPE, not by status code.** A duplicate, a validation
  refusal and a zero-piece result all come back complete on the POST itself; only a real
  run goes async. So the FE checks whether the payload *is* a result, and polls only if
  it is not. An older synchronous BE and this one both work, with no lockstep deploy.
- **An unknown status counts as STILL RUNNING.** Polling once more costs a request;
  calling an unfinished import finished shows a queue that cannot open. Unknown is the
  cheaper error.

While polling, the row reads `Analysing on the server…` rather than a spinner, because
"uploading" and "the BE is four minutes into Whisper" are different things to wait for.

Delays back off — 1s, 2s, then 4s, then 8s. A short clip feels immediate; a 45-minute
talk is not hammered. Budget 30 minutes, after which the row says so and explicitly
tells the coach to check the list **before importing again**.

A dropped poll is **not** treated as a failure — the analysis is still running
server-side — so the FE waits and asks again instead of declaring dead an import that is
about to succeed.

---

## 4. The index — your `status` and `queue_count` are both used

- A **running** import says `Analysing…` and is not openable.
- A **finished** one says `15 to label`.
- A **failed** one stays in the list, greyed, **not openable**, showing your
  `analysis_error` / `detail` underneath.

On your §3 question — *should a zero-piece import write a session row?* — **you were
right and I was wrong.** I argued not to; the row is the evidence, and once the result
is honest the argument for hiding it disappears. The FE now refreshes the index after a
zero-piece result too, precisely so the failed row appears.

`state` defaults to **done** when neither `status` nor `analysis_state` is present, so an
older payload keeps opening rather than becoming an index of rows that all claim to be
working. `queue_count` stays null when absent — the row then says nothing rather than
`0 to label`, which would be a claim we cannot support.

---

## 5. Label notes — now sent

You said the corpus wants them, so there is a field on the labelling screen:
*"Anything worth remembering? Optional."* with your examples as the placeholder.

- **Gated behind an answer**, like the 1–5 row. A note annotates a call, and the body
  builder refuses to construct a body without a real boolean anyway (N3).
- **Saved on blur, without advancing** — clicking away from a text box must not throw the
  coach to the next piece.
- **Per piece**, and re-read from `label.note` on the queue payload, so stepping back
  shows what was saved instead of an empty box. **Please include `note` in the queue's
  `label` object** — otherwise a saved note silently disappears when the coach steps
  back, which reads as data loss.
- Write volume: a graded piece with a note can now be three PUTs (answer → grade →
  note). Your upsert semantics make that safe, but it is more than the two I flagged
  before.

`queue_per_band` is still not exposed. You called it "eventually" and nothing in flight
needs it — say the word.

---

## 6. What I had to ASSUME — please correct any of this

**Rev 2 is not in this repo.** I have your rev-3 summary of it ("the POST returns 202 and
you poll `GET /v2/coach/training-imports/<session_id>`") and nothing else, so the
following are guesses. They are written permissively so that being wrong degrades into
polling rather than into a false result — but they are still guesses.

1. **The poll URL** is `GET /v2/coach/training-imports/<session_id>`.
2. **The 202 body** carries `session_id`. If it does not, the FE cannot poll and reports
   a failure rather than inventing a row.
3. **A working poll** is anything that is not a result: `status`/`analysis_state` of
   `processing`, `running`, anything unrecognised, or a bare acknowledgement.
4. **A finished poll** is `status` ∈ {`complete`, `completed`, `done`, `ready`,
   `succeeded`}, or `ok: true` **with a count field present**.
5. **A dead poll** is `ok: false`, or `status` ∈ {`failed`, `error`, `errored`,
   `cancelled`, `canceled`}.

On (4): a bare `{ok: true, session_id}` is treated as a **receipt, not a result**. If we
read it as finished it would map to zero pieces and announce a failure that never
happened. So a count field is what marks a payload a result. **If your 202 body includes
`ok: true` and no counts, that is the case this rule exists for — but please confirm.**

Also unconfirmed: whether the poll returns the same failure shape as §3 of your rev 3
(`reason` + `detail` + `duration_sec`). The FE assumes yes.

---

## 7. ⚠️ A failed import's idempotency key looks like a permanent lock

This is in your design, not mine, and I think it bites.

You dedupe **before** the gate, the upload and any DB row, and a repeat returns the
original. But a zero-piece import now **writes a session row and returns `ok: false`**.
So:

1. Coach imports a Polish talk on auto-detect → `NO_SPEECH_DETECTED`, row written,
   key recorded.
2. Coach re-imports the same file **with the same settings** — after you tune the
   cutter, say, or fix something else.
3. The key matches → the coach gets the **failed original** back, forever.

For the language case this is fine: language is in the key, so the corrected retry is a
new key. But for `NO_CANDIDATES` — which you call "a tuning question for me, not a bug" —
the coach has changed nothing about the file, and there is nothing they *can* change to
get a fresh run except renaming the file or lying about the topic.

**Suggestion:** record the key only for imports that produced pieces, or release it when
an import ends `failed`. A retry after a failure is exactly the retry that should be
allowed through; the duplicate you are protecting against is the retry after a
**success** the coach could not see.

If you would rather keep it strict, say so and the FE will surface it honestly —
"already tried, and it produced nothing" — but the coach will need a way to force a
re-run.

---

## 8. §4, the empty IMPORTED list — still yours

I cannot run the SQL. What I can say is that the FE's GET succeeded and mapped **zero
rows**, and the only FE-side way that happens with rows present is a missing
`session_id`, which your payload has. So your two candidates stand, and the query will
settle it.

The FE side is now less able to hide it: a failed row is rendered rather than dropped,
and the list distinguishes running / done / failed, so "nothing imported" now means
nothing imported.

---

## 9. What I'd like back

1. **Confirm or correct §6** — the five assumptions about the async contract.
2. **§7** — is a failed import's key released? If not, how does a coach force a re-run?
3. **Include `note` in the queue's `label` object** (§5).
4. **Confirm language belongs in the idempotency key** (§2).
5. Your §6.1 result — run that Polish file with `language: "pl"` and tell me what
   `duration_sec` and `reason` come back. That closes the original §7.

---

## Where to verify

`e2e/corpus.spec.mjs` — 35 checks in a real browser against
`src/app/dev/corpus/page.tsx`, which now stubs **your rev-3 shapes**: the 202 + poll
(answering "processing" once, then complete), the `status: "duplicate"` response, the
`ok: false` + `NO_SPEECH_DETECTED` + `detail` + `duration_sec` failure, and an index
carrying a failed row. It is the most precise statement of what the FE expects, and it
is executable.

Contract and its degradation rules: `src/services/api/trainingCorpus.ts`
(`terminalOutcome` is the whole async contract in one function, and is unit-tested
directly — 48 tests in `trainingCorpus.test.ts`).

**Copy on every one of these screens is still unsigned by the founder.**
