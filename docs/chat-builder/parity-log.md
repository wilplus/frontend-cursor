# Parity log

Each loop: a gap, the builder change, the result. The check is `parityGaps` in `src/lib/willab/chatBuilder/surfaceParity.ts`.

## Loop 1

Gap: the clearer step stored only "Say it straight:". The walk also says "And here's one moment to try another way:" first. The pace step stored only the rushed line. The slow line was missing. Practise stored no sentence and no taps. The walk says "Your turn." and Try it / Keep mine.

Change: a step may carry `lines` (every sentence, in order), `variants` (another sentence for the same step, by id), and `choices` (exactly two taps). The seed fills them from the signed copy. A digit in any of them is refused, same as `fixed`.

Result: `parityGaps(speakingCoachSeed())` is empty. The three walks (best only, a moment to fix, the pace step) keep the same keys as `buildWalkPlan`. The bar for `rec` + `text` is the box, then Record your answer, then Add a photo.

## Still outside this check

The recording screens, Ideal Text, and the processing wait are locked screens. The document names them and does not redraw them. Practice tries inside the recorder (the checking, the landed line, once more, take it with you) stay in the walk code. They are not a second copy in the document yet. Adding them would be the same `lines` and `choices` on those inner steps, once those steps are in the plan the document lists.
