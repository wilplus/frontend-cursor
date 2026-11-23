# Apply Artur's chat

> **Label: Reference.** Do not run this against production from an agent.

The fixture [`arturs-chat-speaking-coach.json`](arturs-chat-speaking-coach.json) is `speakingCoachSeed()`. The parity test fails if the two drift.

On a machine that may write to a draft, not to production:

1. Open Build on Artur's chat.
2. The draft is this document. Saving it calls `PUT /api/v2/coaches/speaking-coach/draft` with the JSON. That route is the phase-1 backend patch. Until that patch is on the backend, the draft stays in this browser only.
3. Do not call publish. Publish is a separate route and is not part of this apply.

The host recipe (What you do, hello, questions, taps, They send, They get back, Who answers) is the `chat` object in the fixture. Setting those parts in Build > Your chat is the same chat. The walk lines are the `walk.steps` on the document, not a separate row.
