# Backend phase 1, ready to apply

> **Label: Reference.** Not in force. The frontend pull request calls these routes. This repository could not push to `wilplus/backend-cursor` (403 for `cursor[bot]`).

Apply on a branch of `wilplus/backend-cursor` from `main`:

```bash
git apply docs/chat-builder/coach-definition-phase1.patch
```

The patch is [`coach-definition-phase1.patch`](coach-definition-phase1.patch), taken from local branch `cursor/coach-definition-phase1-027f` (commit `00ad60a` in the clone). It adds:

- `services/coach_definition.py` — validate, store on `runtime_config`, check a paste, preview that does not write, publish
- `routes/v2/coaches.py` — `/v2/coaches/speaking-coach` and its draft, preview, plugins, publish, and active reads
- `routes/v2/__init__.py` — registers that module
- `services/tempo_stretch.py` — `pick` takes an optional `min_outside`; `tempo_for_take` uses a published dial when one exists, and otherwise today's `MIN_OUTSIDE`
- `tests/test_coach_definition.py`

`python3` ran those four tests without pytest (the module is standard library only). `moment_pick` still reads `noticing_settings`. Only the tempo stretch's bar is read from a published document.

## A visitor's reply, from the host's own words

Nothing here is written to production. The route lives in
[`backend-chat-reply.patch`](backend-chat-reply.patch). Apply it on the Flask
backend when that work is ready.

`POST /v2/chats/<id>/reply` reads the host's saved setup: what they do,
the first line, the questions and taps, what people get back, and the
host's taught question-and-answer pairs. It calls OpenAI on the server
and returns the reply.

Who answers:

- `you`: no model call. The visitor is told the host will answer.
- `shadow`, or a chat about health, law or money: the reply is saved as a
  draft for Answers to send. The visitor does not see it.
- `assistant`: the reply is sent at once, and only after the host has
  sent 20 answers. Before that, the visitor waits.

A changed draft (`POST /v2/chats/setup/drafts/<id>/send` with a body)
is stored as a teaching example: what the person asked, and the host's
words. If that send route already exists, fold this into it. Do not
register the path twice.

The prompt tells the model never to give a score or a number about the
person. The same rule is applied to the text that comes back.

Until this patch is deployed, the frontend route answers `{ preview: true }`
and the screen keeps today's preview. No key is sent to the browser.

A photo (up to 4 MB) is sent to the model as an image. A PDF (up to 8 MB)
is read with `pypdf` and the text is put in the same prompt, so a
question such as "Is this a dry scalp?" can use the photo or the
document. A file that is too big or cannot be read comes back as
`error: too-big` or `error: unreadable`. The visitor sees a plain line
and the file is not sent on.

`pypdf` is the only new Python package.

Environment, on the backend only:

- `OPENAI_API_KEY` — required. The call is skipped when it is missing.
- `OPENAI_MODEL` — optional. Defaults to `gpt-4o-mini`.

## A recording feeds the walk

Apply [`backend-chat-reply.patch`](backend-chat-reply.patch) first. Then apply
[`backend-chat-voice.patch`](backend-chat-voice.patch) on top. Nothing here is
written to production.

When `POST /v2/chats/<id>/reply` receives `kind: "rec"`, the voice
module takes the audio (webm, m4a, or wav). It refuses a file over
25 MB or longer than 5 minutes. It transcribes with OpenAI, asking for
word timestamps, using the same `OPENAI_API_KEY`. It then measures the
sound with librosa: words a minute in each stretch, pauses longer than
about a second with their times, whether the pitch stays even, and
whether the loudness stays even.

Those facts go to GPT with the transcript. The walk that comes back is
their best moment, one place to say another way (a time the visitor can
tap), helper words, and the Ideal Text when the host chose it. A pick
from a list sees the transcript and the same facts.

The facts describe the recording. They do not score the person and they
do not name a feeling. Who answers is unchanged: a draft for the host,
silence when only the host answers, and a send only after 20 answers.

Until this is deployed, the screen keeps today's preview.

Python packages, on the backend: `librosa`, `soundfile`, `numpy`.
`pypdf` is already named above.

Railway also needs `ffmpeg` on the image, so webm and m4a can be read.
A wav does not need it.

Environment, on the backend only:

- `OPENAI_API_KEY` — the same key as the reply. Transcription uses it.
- `OPENAI_TRANSCRIBE_MODEL` — optional. Defaults to `whisper-1`.
