# Usability rounds

> Historical layout audit. The [shared composer](../flows/feedback-walk-and-chat.md#shared-composer-n667) defines the current bottom bar.

> **Label: Reference.** Founder-Approved: Artur, 17 November 2026, score the builder. The method is the Presentation Builder's: drive the flow and score from what the run did (`audit-log.md` on `cursor/presentation-builder-reference`). These scores are the assertions in `src/components/willab/chats/hostsetup/talkAudit.test.tsx`. An earlier draft of this page scored 9.6 by hand. That number is withdrawn.

## How a point is earned

The test taps the real buttons and reads `data-talk-snap`. A check passes only when the saved chat matches. The ratio is passes divided by checks.

| Script | What the test counted | Result |
| --- | --- | --- |
| Speaking Coach | 14 taps: the quote fills the box and does not send, then Send, two Yes and two No for what they can send, three Yes for the walk, Yes for the host checking first, No for pay, Yes for training, No for an outside model, No for code. | Snap is Speaking coach, send recording + message, walk best / fix / words, who shadow, price 0, machine on, no model, no paste. Look is the current step. One more tap, Later, moves the first walk step. |
| A shop, plus the mic | 2 mic presses, then 18 taps. The mic has no speech recognition, so it records and the transcript "A shop" is the brief. Then all four sends, the three walk steps, No and No so an assistant runs it, Yes to pay, No to 2 and Yes to 1, Yes to training, Yes to a model, the hedge quote, Yes to code, and a pasted step. | Snap is all four sends, who assistant, pay on, price 1, machine on, model `hedge`, and the paste kept because it checked. |

Both scripts passed: 2 / 2. That is the usability evidence for this round, and it is above 95%.

## What a 12-year-old meets

One question on screen, in a normal chat bubble. The taps sit above the typing box, in the app's usual reply style. What do you do? offers four jobs. Someone else focuses the box. There is no stepper, no Undo, and no mic. A tap on an earlier answer opens that question again.

## Still open

The tests drive the component in jsdom. They do not open a phone browser, so a real hold of the hardware mic is not in the count. The transcript path is covered by a stand-in recorder and the transcribe function.
