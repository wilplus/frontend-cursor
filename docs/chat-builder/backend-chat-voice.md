# A recording feeds the walk

Apply `docs/chat-builder/backend-chat-reply.patch` first. Then apply
`docs/chat-builder/backend-chat-voice.patch` on top. Nothing here is
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
`pypdf` is already named in the reply note.

Railway also needs `ffmpeg` on the image, so webm and m4a can be read.
A wav does not need it.

Environment, on the backend only:

- `OPENAI_API_KEY` — the same key as the reply. Transcription uses it.
- `OPENAI_TRANSCRIBE_MODEL` — optional. Defaults to `whisper-1`.
