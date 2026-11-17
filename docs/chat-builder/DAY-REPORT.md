# Day report

> **Label: Reference.** Founder-Approved: Artur, 17 November 2026, document the day. Branch `cursor/chat-builder-phase1-027f`. Not merged. Nothing written to production.

## This round

The chat list leads to Build again. "Start your own chat" is the last chat row, above "Start a new project", because that control is the action under the list and the new one is a row like the others. A short sheet explains it. Yes opens Build and pins the chat at the top under its name. Close changes nothing. The name and the pin stay on this device (`docs/chat-builder/backend-own-chat-list.patch`).

The circle is the locked avatar. The host picks an emoji, a colour, a photo, or their initial, from a row in Your chat and from the talk's preview. A three-dots badge sits on the bottom-right, about 40% of the circle, with a white ring.

Share, in the locked top bar's right slot, copies the public link. That is `/c/<token>` when the host already has a join path, and the same route built from the local chat id otherwise. The button says "Link copied", and opens the phone's share sheet where the browser has one.

Finishing the talk writes a coach draft on this device. The Speaking Coach answers produce the fixture, field for field. Recording, Ideal Text and the walk read that draft through `usePublishedCoach`. A shop chat sets every builder field. Publish stays on the device.

The talk also follows the four builders in the competitor research (`638b0c14`, not merged): You decide, a plan you approve, Just build it, a preview with Keep and Next, a change that touches one part, Write this for me, capability chips, a first line, and auto-save plus Publish.

## Scores, from the tests

| Score | Result | Where it was printed |
| --- | --- | --- |
| Usability | 270/270 = 100% | Rubric in `usability-audit.md`. `scripts/own-chat-e2e.mjs` printed `OWN CHAT 16/16` at 390×844 and at 1024×768. |
| Technical | 33/33 = 100% | 29/29 from `talkAudit.test.tsx`, plus `OWN CHAT 4/4` from `ownChatHome.test.tsx`. |

Both are above 95%. The hand-scored 9.6 and 96% from the earlier draft stay withdrawn.

## Scripts

- Fifteen taps, then the screens read the fixture: "fifteen taps build the Speaking Coach".
- Shop, including the mic: "the shop chat sets price, model and paste, and the mic transcribes".
- You decide, express, targeted edit, chips, publish: "express, you decide, a targeted edit, chips, and publish stay on this device".
- Phone: `node scripts/talk-e2e.mjs` runs tap, type and voice for both scripts.

## Known gaps

The draft is not the published coach on the server. Publish does not call production, which is the point of this round. The e2e uses a stand-in for speech recognition, and the shop's free-text name is spoken through that stand-in in the tap run.
