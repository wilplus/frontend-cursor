# End report panel — frontend plan

Aligned with backend plan in backend-cursor repo: `.taskmaster/docs/PLAN-END-REPORT-PANEL.md`.

## Principles

- Single report endpoint for step 5; fresh playback URL on demand; final recording = recording_2_id; scores from session fields.

## Backend contract (summary)

- GET /v2/homework/session/:sessionId/report returns report_text, scores: { warmup, final, overall } (0-100), final_recording: { id, audio_url } with new signed URL each time. Completed, owner-only.
- Optional: GET playback-url to refresh player without full report.

## BFF

- Proxy GET /api/homework/session/[sessionId]/report to backend with auth.
- Optional: proxy playback-url when backend has it.

## Frontend

- Step 5 on mount: fetch report by sessionId; do not persist audio_url; persist only sessionId/minimal context for back later.
- One container: (1) audio from report.final_recording.audio_url, (2) ReportSessionChart(scores), (3) report text. Handle missing/expired URL with message and optional Refresh playback.
- Optional: on play failure or Refresh playback, call playback-url and update audio.src.

## Implementation order

1. BFF route for report endpoint.
2. Optional BFF for playback-url.
3. Frontend client getReport(sessionId).
4. Step 5 fetch report on mount.
5. Build audio player block.
6. Build ReportSessionChart(scores).
7. Wire report text; one container layout (player + chart + text then Start new homework).

## Out of scope

- Trend graph across sessions; BFF caching; persisting audio_url.

## Current vs target

- Current: Step 5 shows score, report text, Start new homework. No player, no chart.
- Target: Step 5 fetches report; shows audio player, scores chart, report text; same CTA; fresh signed URL each time.
