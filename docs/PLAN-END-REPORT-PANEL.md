# End report panel - frontend plan

See backend-cursor repo .taskmaster/docs/PLAN-END-REPORT-PANEL.md for API and principles.

## BFF
Proxy GET /api/homework/session/[sessionId]/report to backend. Optional: playback-url proxy.

## Frontend
Step 5: on mount fetch report by sessionId. Do not persist audio_url. One container: (1) audio player from final_recording.audio_url, (2) ReportSessionChart(scores), (3) report text. Handle expired URL with message and optional Refresh playback.

## Order
1. BFF report route 2. Client getReport 3. Step 5 fetch on mount 4. Audio player 5. ReportSessionChart 6. Layout and wire text.

Out of scope: trend graph, BFF cache, persisting audio_url.
