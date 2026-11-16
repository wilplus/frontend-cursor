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
| Hello and the three first questions | Pass |
| Start recording / Continue recording | Pass. The record button reads the document |
| Empty Ideal Text name, "Your ideal text" | Pass. The heading reads the document |
| Processing wait, the five labels in order | Pass. The wait reads the document |
| A try that lands, one miss, the last miss, and Skip | Pass. The walk reads the document |

`parityGaps` is empty. With no published document the screens keep today's words, which are the same sentences.

## Audits applied

Usability: Clear was a short grey control. It is now the height of the search field. The header and the row bar were the other changes. The first-run "tick all" wizard and the setup sheet's photo and file rows (they only close) are written down and left.

UI: Build's header is `TopBar` (arrow, circle, 16px name, "You run this chat."). A row's bar is 60px with `px-4`, the thread's inset. Details are in `ui-audit.md`.

## Backend patches

Do not apply these to production from an agent.

1. `docs/chat-builder/coach-definition-phase1.patch` — the draft, preview, publish, and active routes. Apply notes in `docs/chat-builder/APPLY.md`.
2. `docs/chat-builder/backend-coach-lines.patch` — after that patch, `refuse` also rejects a digit in `lines`, `variants`, or `choices`.
3. `docs/chat-builder/backend-chat-file.patch` — POST `/v2/chats/<id>/file`, multipart `file`, `{message}` with kind `file`, beside the photo route. The APPLY note is at the top of the file. The frontend proxy is already on this branch.
4. `docs/chat-builder/backend-send-on-reads.patch` — add `send` on GET `/v2/chats/<id>/host` and on the widget read. The APPLY note is at the top. If `send` is missing, the bar keeps `answer_with`.

Applying Artur's chat: `docs/chat-builder/APPLY-ARTURS-CHAT.md`. The fixture is `docs/chat-builder/arturs-chat-speaking-coach.json`. It is not pushed to production by this work.

## Morning test

On http://localhost:3100/chat, signed in as a host on the chat-builder ring.

1. Open the list. Tap the row that opens Build (Will's row when that chat is yours).
2. The header is the arrow, your circle, the chat's name, and "You run this chat." Under it: Your chat, AI models.
3. Your chat is a page. Type in Search. Clear wipes it. The rows come back.
4. Tap Name. The first bubble is that row. The header arrow returns to the page, not the list of chats.
5. Tap Keep. The next row's chat opens. On the last row, Keep returns to the page.
6. Tap They send. Recording and a message are the speaking coach's pair. Photo and file stay off unless you turn them on.
7. AI models is the other tab. The rows match the table's type and height. Back from the page returns to the list of chats.
8. Start a recording from a project. The button says Start recording, or Continue recording once a practice exists.
9. After the Take, the wait says Processing your recording, then the later labels, then the Ideal Text. With no project name the heading is Your ideal text.
10. Open the feedback walk. You meet the best moment, one moment to try another way, Your turn, Try it or Keep mine. A try that lands says Yes. That's it. One miss says Close. Once more. The last miss says Good try. Take it with you. Then the helper words and Lesson done.
11. Those sentences are on the fixture. They are not written onto production by this branch. Live shows them when that draft is the one loaded.

## Commits tonight

- `116aa12e` Write the speaking coach down as it already is.
- `6349902c` Carry the walk's extra lines on the coach document.
- `54f5f096` Make Clear a full-height tap on Your chat search.
- `4de32dab` Use the chats header on Build, and line the row bar up with it.
- `09aafae7` Let the coach document name the wait, the record button, and the tries.
- `c7c96210` Record the audits and the two backend patches still to open.
