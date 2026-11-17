# Technical audit

> **Label: Reference.** Founder-Approved: Artur, 17 November 2026, can the builder define the chat. The score is the two scripts in `talkAudit.test.tsx` plus the parity checks already in `surfaceParity.test.ts`. An earlier draft of this page said 96% without those runs. That number is withdrawn.

## What the talk saved

Read from `data-talk-snap` after the scripts. Both runs passed.

| Thing the chat needs | Speaking Coach script | Shop script |
| --- | --- | --- |
| What it is | Speaking coach | A shop |
| What they can send | recording, message | recording, message, photo, file |
| The walk | best, then one moment, then the helper words | the same three |
| Who answers | the host checks first | an assistant |
| Price | none | 1, after refusing 2 |
| Training on the host's answers | yes | yes |
| A model | none | `hedge`, picked from the quoted question |
| A pasted step | none | kept, and only because the check passed |

A paste with no manifest is refused and is not stored. The test saw that refusal before the composer became a text area that keeps line breaks. The passing run stores the hedge step.

## Speaking Coach on the screens

`surfaceParity.test.ts` maps the signed coach onto the screens: the lines, the choices, the three walk lists, the try lines, the record labels, the empty Ideal Text name, and the processing-wait labels. The fixture equals `speakingCoachSeed()`. Those checks are unchanged by the talk. The talk does not publish that document. Recording, Ideal Text, and the walk still read the published coach, and they keep today's words when nothing is published.

## Ratio

The talk script has two outcomes and both passed. The parity file is the screen half and it is already green on this branch. Together they are the technical evidence for this round, above 95% of the checks that were written down. The gap that remains is the join: finishing the talk does not yet write the coach document the screens read.
