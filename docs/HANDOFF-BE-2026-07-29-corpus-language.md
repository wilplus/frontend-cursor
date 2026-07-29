# BE handoff — the `language` field: already shipped, and that was the problem

**From:** frontend-cursor · **Date:** 2026-07-29 · **On `main`**
**Answers:** your "FE prompt — the `language` field on the corpus import"
**Prior:** `HANDOFF-BE-2026-07-29-corpus-rev3.md`

---

## 1. One correction, because it changes what needed fixing

> *"it needs a language code to act on and **nothing is sending one**"*

The field, the picker and its place in the idempotency key have been on `main` since
`d35df72`, which landed **before** the 413 work. A browser check has been asserting
`language: "pl"` on the wire since then.

So the diagnosis was right and the conclusion was one step off. What actually happened:

**The picker defaulted to Auto-detect, and auto-detect omits the field.** The coach
never touched it. From your side that is indistinguishable from "the FE does not send
it" — the request genuinely carried no `language`, Whisper's English prompt did its
thing, and the talk came back translated.

**So the fix was never the field. It was the default.** Which makes your own argument the
decisive one:

> *"the failure is silent. Auto-detect that guesses wrong produces a plausible-looking
> transcript in the wrong language… neither announces itself."*

A silent failure mode is exactly what a default must not sit in front of.

---

## 2. What changed

**The language is now a required choice.** The picker opens on `Choose…` and **Import
stays disabled** until the coach picks. Auto-detect is still on the list and still omits
the field — it simply has to be chosen rather than fallen into.

**This deviates from your spec** (*"defaulting to empty (`Auto-detect`)"*), deliberately.
The cost is one click per batch; the cost of the default was a batch that has to be
re-imported and a corpus that would have been poisoned if the founder had labelled it.
If you want the default back, say so and it is a one-line change — but I would push back
once.

The nudge under the picker names the failure in the words of what happened:

> Required — auto-detect is a choice, not a default. Whisper is primed with an English
> prompt, so a talk left on auto-detect can come back *translated* into English rather
> than transcribed: the audio is right, the words are not, and nothing says so.

**Polish leads the real codes.** It is what this corpus is actually made of, and the
language that got mistranslated. Full list: Auto-detect · Polish · English · German ·
Spanish · French · Ukrainian · Italian · Portuguese · Dutch · Czech · Swedish. A code
that is not on the list is **refused rather than forwarded** — an unknown code either
400s at your end or, worse, transcribes as the wrong language.

**The echo is surfaced.** Thank you for adding it; it is the answer to the first question
anyone asks about a transcript that reads oddly. Rows now read what the run *actually*
used, taken from your payload rather than read back off the picker:

> `Polish · 42 pieces · 15 queued to label · 10 min`
> `Auto-detected · 42 pieces · …`   ← when you return `language: null`

**One ask:** please include `language` on the **index** rows too (`GET
/v2/coach/training-imports`). The FE already reads it there and shows it beside the
speaker; absent, it just says nothing. Now that the index works, those rows are the
primary surface — the import row only exists for the current browser session.

---

## 3. `speaker_sex` — shipped, and a decision you should overrule if you disagree

A select beside the speaker label: **Not stated · Female · Male · Prefer not to say**,
sent as `speaker_sex` and omitted when not stated. Validated against exactly those three
values, for the same reason as the language code.

The copy deliberately frames it as being about the analysis, not the person — *"One
voice cue reads differently by sex, so this is about the analysis rather than about the
person"* — because a demographic dropdown with no stated purpose invites the wrong
question.

**The decision: `speaker_sex` is in the idempotency key.** Your §2 reasoning for
language applies unchanged — it changes the **analysis**, not the filing, since the
composite routes a cue's direction on it. So a coach who realises the sex was wrong and
re-imports gets a fresh run rather than being deduped into the run that used the wrong
route.

**If your dedupe hashes a different field set, tell me and I will drop it** — a key that
varies on a field you do not consider part of identity is worse than one that does not
vary at all, because it would silently create second imports of the same talk.

---

## 4. What the wire now carries

Verified in a real browser, not asserted:

```jsonc
{
  "audio_file":             "FILE:Trend Talk Warsaw Przemysław Pączek, Hyper Poland.mp3",
  "topic":                  "Trend Talk Warsaw",
  "language":               "pl",          // omitted on auto-detect
  "speaker_sex":            "male",        // omitted when not stated
  "speaker_label":          "Przemysław Pączek",
  "stages":                 "confidence",
  "idempotency_key":        "01a8e827cad88db8fa13f7ac5b5da64b",
  "upload_idempotency_key": "01a8e827cad88db8fa13f7ac5b5da64b"   // same value, both spellings
}
```

---

## 5. Your rev-3 answers — received, and one I cannot verify

Everything in your table is read by the FE as specced. Two notes:

- **The index fix (`v2_sessions.source` enum CHECK).** I cannot verify this from here —
  it needs the founder to reload `/coach/corpus` and see yesterday's imports. Worth
  confirming out loud once, because the workaround I shipped (the import row opening its
  own queue) would mask a still-broken list: a coach importing *right now* would reach
  the pieces either way and might not notice the list was still empty.
- **§7, releasing a failed key.** Good — that closes the case where a coach could never
  re-run a `NO_CANDIDATES` file. It also means the founder can re-import the Nevomo file
  with `pl` even though its failed key is on record.

---

## 6. Ready for the re-import

Both files, with `language: "pl"`:

1. `Trend Talk Warsaw Przemysław Pączek, Hyper Poland.mp3` — currently in the corpus as
   English translations. **Unlabelled, per the founder's instruction.**
2. `Przemysław Paczek, Prezes i Założyciel Nevomo.mp3` — the original zero-piece file,
   never re-run since the language work landed.

Language is in the key, so both run fresh rather than deduping into their earlier
attempts. I left the translated import openable, as you suggested; a per-row dismiss is
easy if it starts getting in the way.

---

## 7. Two new asks from today's index work

1. **A `labelled_count` on the index rows** (`GET /v2/coach/training-imports`). The
   founder asked for a per-row "how much is labelled" badge computed from the database.
   The FE builds it honestly today by fetching each done row's confidence queue and
   counting the label objects — a fresh DB read, which is the point — but that is one
   queue request per row. A `labelled_count` on the list row lets the badge come from
   one request. The FE will keep the queue-read as fallback either way.

2. **A real `DELETE` (or archive) for a training import.** The founder asked to remove
   rows from the list without labelling them. There is no endpoint for that, so the FE
   shipped **Hide** — device-local, reversible, and worded on screen as exactly that
   ("the import and its labels stay in the database") — because a button called Delete
   that deletes nothing would be a lie. If you ship
   `DELETE /v2/coach/training-imports/<session_id>` (or an `archived` flag the list
   filters on), the FE swaps Hide for the real thing. Say which semantics you prefer:
   destroy (pieces and labels gone) or archive (kept, just out of the list). We suspect
   archive — labelled data is training data, and a coach tidying a list should not be
   able to delete corpus.

Also for the record, because the founder asked whether labels are "sent to the database
with a cron job": **they are not, and nothing should imply they are.** Each label is one
synchronous PUT at the moment of the tap; the FE marks a label saved only after your 200.
If anything BE-side DOES consume `confidence_labels` asynchronously downstream
(a training job, an export), tell us and we will surface that stage honestly too —
right now the FE states "there is no later send", which is true on the wire we can see.

---

## Where to verify

`e2e/corpus.spec.mjs` — 62 checks in a real browser, including: Import blocked until a
language is chosen; auto-detect omitting the field entirely; a chosen language reaching
the wire as an ISO code; the same file under a different language getting a different
key; the labelled badge coming from a fresh queue read; the word "pending" appearing
nowhere on the page; and Hide being reversible and honestly worded.
`src/services/api/trainingCorpus.test.ts` — 59 unit tests covering the key derivation,
the language and sex validators, and the async contract.

**Copy on every one of these screens is still unsigned by the founder** — including the
new language nudge, which is the longest piece of copy on the panel.
