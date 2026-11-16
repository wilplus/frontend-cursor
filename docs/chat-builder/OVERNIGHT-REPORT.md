# Overnight report

> **Label: Reference.** Branch `cursor/chat-builder-phase1-027f`, pull request 1427. Nothing here was merged, and nothing was written to the production backend.

## What was built

A precise read of the speaking coach, a coach document that carries the walk's extra sentences and the two practise taps, a parity check against the signed walk, Artur's fixture, and two small Build fixes: Clear is a full-height tap, and Build uses the chats' header.

## Builder capabilities added

A walk step may now carry:

- `lines`, every signed sentence in order
- `variants`, another sentence for the same step, by id (the slow pace line)
- `choices`, exactly two taps (Try it, Keep mine)

A digit in any of them is refused, the same rule as `fixed`.

## Parity

| Item | Result |
| --- | --- |
| Praise, clearer (both sentences), AI clip, Your turn, rushed pace, slow pace, other speaker, helper words, Lesson done | Pass |
| Practise taps Try it / Keep mine | Pass |
| Walk order: best only, a moment to fix, the pace step | Pass |
| Bar: nothing asked is the box; the chat asking records; a photo asked is Add a photo; thanks stays off because typing is on | Pass |
| Hello and the three first questions | Pass, on the document |
| Recording screens, Ideal Text, processing wait | Not redrawn. Named on the document. Locked screens |
| Tries inside the recorder (landed, once more, take it with you) | Not in the document's step list. Same gap as before tonight |

The check is `parityGaps` in `src/lib/willab/chatBuilder/surfaceParity.ts`. Empty means the rows above that say Pass.

## Audits applied

Usability: Clear was a short grey control. It is now the height of the search field. The header and the row bar were the other changes. The first-run "tick all" wizard and the setup sheet's photo and file rows (they only close) are written down and left.

UI: Build's header is `TopBar` (arrow, circle, 16px name, "You run this chat."). A row's bar is 60px with `px-4`, the thread's inset. Details are in `ui-audit.md`.

## Backend patches

Do not apply these to production from an agent.

1. `docs/chat-builder/coach-definition-phase1.patch` — the draft, preview, publish, and active routes. Apply notes in `docs/chat-builder/APPLY.md`.
2. `docs/chat-builder/backend-coach-lines.patch` — after that patch, `refuse` also rejects a digit in `lines`, `variants`, or `choices`.
3. `POST /v2/chats/<id>/file` multipart `file`, same `{message}` shape as the photo route. The frontend proxy is already on this branch. Without the backend route, Send a file fails closed.
4. `GET /v2/chats/<id>/host` and the widget read should include `send`. If they do not, the bar keeps `answer_with`.

Applying Artur's chat: `docs/chat-builder/APPLY-ARTURS-CHAT.md`. The fixture is `docs/chat-builder/arturs-chat-speaking-coach.json`. It is not pushed to production by this work.

## Morning test

On http://localhost:3100/chat, signed in as a host on the chat-builder ring.

1. Open the list. Tap the row that opens Build (Will's row when that chat is yours).
2. The header is the arrow, your circle, the chat's name, and "You run this chat." Under it: Your chat, AI models.
3. Your chat is a page. Type in Search. Clear wipes it. The rows come back.
4. Tap Name. The first bubble is that row. The header arrow returns to the page, not the list of chats.
5. Tap Keep. The next row's chat opens. On the last row, Keep returns to the page.
6. Tap They send. Recording and a message are the speaking coach's pair. Photo and file stay off unless you turn them on.
7. AI models is the other tab. Back from the page returns to the list of chats.
8. The walk lines in the fixture (the best moment, "Say it straight:", "Lesson done.") are on the document. They show in Live when that draft is the one loaded. They are not written onto production by this branch.

## Commits tonight

- `116aa12e` Write the speaking coach down as it already is.
- `6349902c` Carry the walk's extra lines on the coach document.
- `54f5f096` Make Clear a full-height tap on Your chat search.
- `4de32dab` Use the chats header on Build, and line the row bar up with it.
