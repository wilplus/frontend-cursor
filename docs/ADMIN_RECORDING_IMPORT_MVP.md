# Admin Recording Import MVP

This page is the fast-ingestion path for building the first ML dataset without waiting for the full student homework flow.

Frontend route:

- `/admin/ml`

Frontend BFF route:

- `POST /api/admin/recordings/import`

Backend target:

- `POST /v2/admin/recordings/import`

## Goal

Allow an admin to:

1. upload an audio file from outside the app
2. attach optional metadata and transcript
3. save an initial ML review label in the same submit action
4. receive a new `recording_id` immediately

This flow should be independent from:

- homework session creation
- student self-rating
- task flow
- report generation timing

## Request

The frontend sends `multipart/form-data`.

Required fields:

- `audio_file`: binary audio file
- `source_kind`: one of `internet`, `coach_upload`, `manual_import`
- `overall_quality`: one of `good`, `bad`, `unclear`
- `confidence_score`: integer `1-10`
- `coach_style_score`: integer `1-10`
- `rubric_version`: currently `"v1"`

Optional fields:

- `source_url`
- `source_title`
- `speaker_label`
- `language_code`
- `transcript_text`
- `import_notes`
- `review_notes`

## Backend Behavior

On one successful request, backend should:

1. validate admin auth
2. validate the multipart fields
3. store the original audio file
4. create one canonical `recording_id`
5. mark the recording source as admin-imported
6. store source metadata
7. create the initial ML review row
8. enqueue or trigger the normal audio-processing pipeline

Recommended source marker:

- `recording_origin = 'admin_import'`

Recommended source-kind column:

- `source_kind`

## Recommended Data Mapping

If using the newer raw pipeline tables:

- create one row in `audio_recordings`
- optionally create a linked compatibility row if your app still expects another recordings table
- create one row in `recording_reviews`

Suggested metadata placement:

- `audio_recordings.source_metadata`:
  - `source_kind`
  - `source_url`
  - `source_title`
  - `speaker_label`
  - `language_code`
  - `transcript_text`
  - `import_notes`
  - `recording_origin: "admin_import"`

Initial ML review placement:

- `recording_reviews.recording_id`
- `recording_reviews.overall_quality`
- `recording_reviews.confidence_score`
- `recording_reviews.coach_style_score`
- `recording_reviews.notes = review_notes`
- `recording_reviews.rubric_version = "v1"`

## Response

Return JSON like:

```json
{
  "status": "ok",
  "recording_id": "rec_123",
  "review_id": "rev_123",
  "playback_url": "https://...",
  "message": "Recording imported and queued for processing."
}
```

Minimal required fields:

- `status`
- `recording_id`

Optional but useful:

- `review_id`
- `playback_url`
- `message`

## Error Cases

Use clear admin-facing errors:

- `400` invalid form data
- `401` unauthorized
- `413` file too large
- `415` unsupported audio format
- `422` invalid label values
- `500` import failed

## Product Rules

- Do not require a `session_id`
- Do not require a `user_id`
- Do not require a student task
- Do not require report completion before saving the import
- The import should still be processable by the same downstream ML/audio pipeline as live app recordings

## Why This Matters

This page lets the team bootstrap the dataset faster by separating:

- product recordings from real student usage
- dataset recordings imported by admins

Both should end up in the same labeling and feature-extraction system, but they should not depend on the same user journey.
