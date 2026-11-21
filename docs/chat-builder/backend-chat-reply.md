# A visitor's reply, from the host's own words

Nothing here is written to production. The route lives in
`docs/chat-builder/backend-chat-reply.patch`. Apply it on the Flask
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

Environment, on the backend only:

- `OPENAI_API_KEY` — required. The call is skipped when it is missing.
- `OPENAI_MODEL` — optional. Defaults to `gpt-4o-mini`.
