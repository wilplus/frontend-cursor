# ML 1.0 labeling guide

This document defines the first production-safe labeling workflow for ML 1.0.

## Scope

ML 1.0 uses **whole-recording / whole-session labels** captured by admins from the existing report review flow.

The goal is to create a clean first dataset before building raw-frame storage or automated coaching models.

## Data model

Run this migration first:

- `docs/migrations/recording_reviews.sql`

`recording_reviews` is intentionally separate from student-facing feedback.

Use it for:

- `overall_quality`: `good | bad | unclear`
- `confidence_score`: `1-5`
- `coach_style_score`: `1-10`
- `notes`
- `reviewer_id`
- `rubric_version`

Do not store internal ML notes in:

- `coach_message`
- `coach_grade`
- `admin_grade`

Those fields already serve different product purposes.

## Labeling rubric v1

Use this rubric consistently.

### `overall_quality`

`good`
- understandable and usable in real-life communication
- no major delivery breakdown
- pacing and confidence are acceptable overall

`bad`
- hard to follow or hard to trust
- delivery breaks communication in a meaningful way
- pacing, confidence, or clarity is weak enough that the recording is not yet ready

`unclear`
- audio quality is poor
- the performance is mixed and hard to judge
- the reviewer is not confident enough to call it good or bad

### `confidence_score` (1-5)

`1`
- very low confidence
- hesitant, withdrawn, fragile delivery

`3`
- mixed confidence
- some stable moments, some weak moments

`5`
- strong confidence
- stable, present, believable delivery

### `coach_style_score` (1-10)

`1-3`
- clearly weak performance
- not ready for real-life use

`4-6`
- developing but inconsistent
- some useful qualities, still significant issues

`7-8`
- solid and usable
- clear communication with manageable weaknesses

`9-10`
- strong, persuasive, and well-controlled
- close to target delivery for this student

### `notes`

Notes should explain the label in natural language.

Good notes:

- `Clear message, steady pace, confident opening, slight fade at the end.`
- `Too hesitant and quiet, message gets lost after the first 20 seconds.`
- `Audio is noisy and I cannot judge confidence reliably.`

Bad notes:

- `good`
- `bad`
- `not sure`

## Review rules

Use these rules during admin review:

1. Listen to the recording before labeling.
2. Read the transcript when useful, but do not rely on transcript alone.
3. Use `unclear` when audio quality or ambiguity makes the label unreliable.
4. Keep student-facing coaching separate from internal ML notes.
5. Keep using the same rubric version until you intentionally publish a new one.

## Training readiness

Do not start training as soon as labels exist.

Start the first baseline model when all of these are true:

1. At least `150-250` sessions have a completed ML review.
2. Most labels use the same `rubric_version`.
3. You have enough balance between `good` and `bad`.
4. `unclear` is present but not dominating the dataset.
5. Reviewers are applying the rubric consistently.

For the very first model:

- train `good` vs `bad`
- exclude `unclear`
- keep `coach_style_score` as a second target
- keep `confidence_score` as a third target

## Export shape for ML

The first dataset export should include:

- `session_id`
- `recording_id`
- `reviewer_id`
- `overall_quality`
- `confidence_score`
- `coach_style_score`
- `notes`
- `rubric_version`
- `created_at`
- `updated_at`

It should also join any already-available derived session metrics, such as:

- session report score
- transcript availability
- filler-word counts
- recording duration

## Next architecture step after ML 1.0 labels

Once labels are flowing and the rubric is stable, add raw recording infrastructure:

- `audio_recordings`
- `recording_frames`
- `recording_segments`
- `recording_annotations`
- `analysis_runs`

That phase should come after labeling discipline is established, not before.
