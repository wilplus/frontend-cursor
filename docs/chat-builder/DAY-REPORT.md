# Day report

> **Label: Reference.** Founder-Approved: Artur, 17 November 2026, document the day. Branch `cursor/chat-builder-phase1-027f`. Not merged. Nothing written to production.

## This round

Finishing the talk writes a coach draft on this device. The Speaking Coach answers produce the fixture, field for field. Recording, Ideal Text and the walk read that draft through `usePublishedCoach`. A shop chat sets every builder field. Publish stays on the device.

The talk also follows the four builders in the competitor research (`638b0c14`, not merged): You decide, a plan you approve, Just build it, a preview with Keep and Next, a change that touches one part, Write this for me, capability chips, a first line, and auto-save plus Publish.

## Scores, from the tests

| Score | Result | Where it was printed |
| --- | --- | --- |
| Usability | 190/190 = 100% | Rubric in `usability-audit.md`. Browser run: `scripts/talk-e2e.mjs` printed `USABILITY 30/30 = 100%` at 390×844. Pattern test in `talkAudit.test.tsx` logged 10/10. |
| Technical | 29/29 = 100% | `talkAudit.test.tsx`, "prints the technical score from the fixture and the shop fields" |

Both are above 95%. The hand-scored 9.6 and 96% from the earlier draft stay withdrawn.

## Scripts

- Fifteen taps, then the screens read the fixture: "fifteen taps build the Speaking Coach".
- Shop, including the mic: "the shop chat sets price, model and paste, and the mic transcribes".
- You decide, express, targeted edit, chips, publish: "express, you decide, a targeted edit, chips, and publish stay on this device".
- Phone: `node scripts/talk-e2e.mjs` runs tap, type and voice for both scripts.

## Known gaps

The draft is not the published coach on the server. Publish does not call production, which is the point of this round. The e2e uses a stand-in for speech recognition, and the shop's free-text name is spoken through that stand-in in the tap run.
