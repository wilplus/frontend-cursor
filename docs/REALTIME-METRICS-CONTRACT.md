# Real-time metrics (recording-metrics-chunk) — contract

Stateless **chunk-in → metrics-out** endpoint for the ambient glow and pause-dot during recording. Frontend sends raw PCM chunks; backend returns `pause_score`, `voiced_ratio`, and optional **pause detection** for the red dot.

---

## Endpoint

**POST** `/api/homework/session/<session_id>/recording-metrics-chunk`  
(BFF proxies to backend `/v2/homework/session/<session_id>/recording-metrics-chunk`.)

- **Auth:** Required (`Authorization: Bearer <supabase_access_token>`).
- **Rate limit:** 120 requests per 60 seconds per (user, session). 429 if exceeded.

---

## Request

- **Body:** Raw **PCM16 little-endian mono** (binary). Prefer **16 kHz**; backend may accept 48 kHz and resample.
- **Headers:** `Content-Type: application/octet-stream`, optional `X-Sample-Rate`, `X-Chunk-Seq` / `X-Seq`, `X-Chunk-Start-Ms` / `X-T-Ms`, `X-Recording-Slot`.  
- **X-Debug: 1** — backend includes `_debug` in the response (e.g. `pause_why`, `tail_20`).

---

## Response (200)

```json
{
  "seq": 42,
  "t_ms": 10500,
  "voiced_ratio": 0.82,
  "pause_score": 0.91,
  "pause_detected": false
}
```

| Field | Meaning |
|-------|--------|
| **seq** | Echo of request sequence. |
| **t_ms** | Echo of request start time (ms). |
| **voiced_ratio** | Fraction of this chunk that is voice (0–1). &lt; 0.15 → silence gating (frontend may freeze glow / not punish). |
| **pause_score** | 0–1; drives glow brightness (1 = ideal pausing). |
| **pause_detected** | When **true**, backend detected a **pause event** (silent run ≥ 200 ms after speech). Frontend should show the **red dot** for this chunk. |

---

## pause_why (debug)

When **X-Debug: 1** is sent, the backend can include **pause_why** (in the root response or under `_debug`) to explain why a pause was or wasn’t counted. Use this to debug missing or unexpected red dots.

| Value | Meaning |
|-------|--------|
| **ok** | Pause was detected; `pause_detected` is true. If the dot still doesn’t show, the issue is on the frontend (not using `pause_detected`). |
| **silence_gated** | Chunk had almost no voice. Check: are you sending PCM while the user is speaking? (e.g. mic level, capture path.) |
| **last_frame_silent** | Window ends in silence; expected while they’re in a pause. |
| **run_too_short** | Short silence then speech; `run_silent_ms` &lt; 200 ms so it didn’t count as a pause. |
| **initial_silence** | Backend thinks there was no speech before the silence (start of recording or very quiet start). |

---

## tail_20 (debug)

With **X-Debug: 1**, backend may return **tail_20** (e.g. under `_debug`): a string of the last 20 frames as **S** (silence) or **V** (voice). Use it to confirm the pattern.

- After a real pause you should see something like: **…SSSSSSSSSSVVV** (many S then V when they start speaking again).
- If you see only S or odd patterns, check PCM capture and that chunks are sent while the user is speaking.

---

## Frontend behaviour

1. **Glow:** Drive **brightness** from **pause_score** (e.g. lightness = 22 + 50 × pause_score). Hue fixed (e.g. green 140).
2. **Red dot:** When **pause_detected === true**, set `lastPauseDetectedAt = Date.now()` and show the red dot for ~450 ms. If the backend does not send `pause_detected`, fall back to showing the dot when **voiced_ratio &lt; 0.15** after at least one speech chunk (to avoid initial silence).
3. **Silence gating:** When **voiced_ratio &lt; 0.15**, do not update glow from this chunk (freeze or fade); optional: still show dot if `pause_detected` is true.
4. **X-Debug: 1:** Frontend can send this to get `pause_why` and `tail_20` for debugging; log or display in dev tools as needed.

---

## Summary

| Backend sends | Frontend does |
|---------------|----------------|
| **pause_detected: true** | Show red dot (backend says pause was detected). |
| **voiced_ratio &lt; 0.15** | Silence gating (don’t update glow); if no `pause_detected`, may still show dot after speech. |
| **pause_score** | Update glow brightness. |
| **pause_why** (with X-Debug: 1) | Use to debug why dot did or didn’t appear. |
| **tail_20** (with X-Debug: 1) | Use to confirm S/V pattern (e.g. …SSSSVVV). |
