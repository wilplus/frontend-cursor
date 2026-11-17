# Technical audit

> **Label: Reference.** Founder-Approved: Artur, 17 November 2026, can the builder define the chat. Each row is 1 point. The score is printed by `talkAudit.test.tsx` ("prints the technical score from the fixture and the shop fields") and by the two scripts above it. An earlier hand score on this page is withdrawn.

## Rubric

One point for the fixture match. One point for each Speaking Coach parity item from `parityGaps`. One point for each field the builder can set.

| # | Point | Result |
| --- | --- | --- |
| 1 | The talk-built Speaking Coach equals `arturs-chat-speaking-coach.json` | PASS |
| 2–9 | Lines: praise, clearer, exVideo, practise, tempo, others, words, done | PASS |
| 10 | Practise choices | PASS |
| 11–14 | Tries: landed, once more, take it with you, skipped | PASS |
| 15–16 | Record before and after | PASS |
| 17 | Ideal Text empty name | PASS |
| 18 | Processing wait | PASS |
| 19–21 | Walk keys: praise, moment, tempo | PASS |
| 22 | Sends | PASS |
| 23 | Models | PASS |
| 24 | Pricing | PASS |
| 25 | API | PASS |
| 26 | Other models | PASS |
| 27 | Training machine | PASS |
| 28 | Custom code | PASS |
| 29 | Interaction | PASS |

The test printed `29/29 = 100%`.

## The host's own chat on the list

These stay on this device. `docs/chat-builder/backend-own-chat-list.patch` says what a later backend read would return. Nothing is written to production.

| # | Point | Result |
| --- | --- | --- |
| 30 | The starter row is last, above Start a new project, and Close changes nothing | PASS |
| 31 | Yes pins the chat at the top and Back returns to the list | PASS |
| 32 | Share copies `/c/<id>`, or `own_chat.link.path` when the host already has one | PASS |
| 33 | The icon defaults to the initial, and the badge is 40% of the circle | PASS |

`ownChatHome.test.tsx` printed `OWN CHAT 4/4 = 100%`. With the 29 above, that is 33/33.

## How the screens read it

`usePublishedCoach` reads the draft on this device and does not call the network while that draft is there. "fifteen taps build the Speaking Coach" renders `IdealTextHeading` from that hook and checks the record label, the empty Ideal Text name, and the walk plan against the fixture. The shop script checks sends, models, pricing, API, other models, the training machine, the paste, and who answers.

Publish sets a flag on the draft. It does not call the backend. The e2e aborted every request that was not the dev server (`no request left this machine`).
