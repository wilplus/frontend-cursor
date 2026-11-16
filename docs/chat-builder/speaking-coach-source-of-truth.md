# Speaking coach, as it is

> **Label: Reference.** What a speaker meets today, read from this repo. The builder's document has to match it. A line here is a line already in the product.

## The chat

| Part | Value |
| --- | --- |
| What you do | Speaking coach |
| Why people come | People come to you to speak so others listen. |
| Hello | Hi. Record a short talk, and I'll tell you what worked. |
| First questions | What talk are you getting ready for? / Who will be listening? / What is the one thing they should remember? |
| Taps | Practise a talk / Get ready for a pitch / Answer a hard question |
| They send | A recording and a message (`rec`, `text`). No photo. No file. |
| They get back | Their own words, tidied (`words`) |
| Who answers | I draft, you send (`shadow`) |
| Care | No |
| Open to people | No, until the host opens it |

These live on `speakingCoachSeed().chat` (`src/lib/willab/chatBuilder/seed.ts`). The lounge's own question list on the document is empty: the three questions above are the chat's, not a second set.

## The bar

`send` is `["rec", "text"]`, so typing is on and a recording is on. Thanks taps stay off, because a chat that types has no thanks taps.

| State | Middle | Behind + |
| --- | --- | --- |
| Nothing asked | Box, placeholder Ask {name} | Record your question |
| The chat asks | Record your answer | Type your answer |
| A photo asked | Add a photo | Record your question is not the middle |
| Thanks | The box stays | No 👀 👍 🙏 |

The + stays on the left. One thing sits in the middle.

## The walk, in order

The plan is `buildWalkPlan`. A published document that lists the same steps in the same order is that plan. Turning a step to `never` drops it.

One thing walk, when there is a best moment and one fix:

1. page
2. praise — "To our ears, this one sounded really sure."
3. clearer — "And here's one moment to try another way:" then "Say it straight:"
4. the AI clip — "Say this one like your confident moment:"
5. practise — "Your turn." Taps: Try it, Keep mine
6. words — "These are your helper words. They'll appear on screen during your next take, to remind you of what you learned here."
7. done — "Lesson done."
8. end

When the one fix is pace: praise, then "You rushed here. Let it breathe." A slow stretch uses the same step with "You slowed down here. Keep it moving." Then the helper words and Lesson done.

From the second Take, one moment of another speaker: "Let's see how you find this voice. It helps us understand you and serve you better."

No digits on these lines. A count such as "Practice 2 of 9" is the card, not a walk line.

Try caps: the one-thing walk's cap and the older walk's cap, read from `walkPlan.ts`, not copied as new numbers.

## What the document does not redraw

The recording screens, the Ideal Text page, and the wait while a Take processes stay the locked screens. The document names them (`shell.surfaces`: feedback walk, then Ideal Text; the clock is 300 seconds) and does not replace their layout. A missing or refused document leaves the walk on today's plan.

Pinned pace numbers stay the ones in code (`tempo_stretch.GREEN_LOW` 0.275, `GREEN_HIGH` 0.725, land share from `LAND_GREEN_SHARE`). Moving one is refused.
