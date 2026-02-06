# Ambient Glow — Frontend implementation contract

This document defines how the frontend implements the **central glow circle** during recording (steps 1 and 3 of the homework flow), so it stays in sync with the backend: **PCM via AudioWorklet, stateless chunk endpoint, Whisper after full upload.**

---

## 1. Scope (unchanged)

- **Glow:** Central circle only (no full-screen background).
- **No demo mode,** no analytics page (analytics only in report).
- **Two recording moments:** recording_1 (step 1), recording_2 (step 3).
- **Real-time:** Chunks → backend → metrics → circle color. On **Stop**, upload full recording to existing `recording-1` / `recording-2` endpoints; Whisper and report unchanged.

---

## 2. Chunk format and transport

### 2.1 Prefer binary PCM16 (not base64)

- **Format:** Raw **PCM 16-bit little-endian** (PCM16LE).
- **Transport:** Send as **binary body** with `Content-Type: application/octet-stream`. Do **not** use base64 in JSON unless the backend only accepts that; binary is preferred for real-time and size.
- **Backend:** Consumes with e.g. `numpy.frombuffer(..., dtype=np.int16)`.

### 2.2 Sample rate and chunk size (explicit)

- **Client responsibility:** Resample to **16 kHz** before sending chunks. Do not assume the microphone is 16 kHz; typical capture is 48 kHz.
- **Chunk duration:** Send **250 ms** chunks = **4000 samples** at 16 kHz (8000 bytes per chunk), or **500 ms** = 8000 samples (16000 bytes). Document which you use; 250 ms is a good default for responsiveness.
- **If client cannot resample:** Send at native rate and set a **header** (e.g. `X-Audio-Sample-Rate: 48000`); backend must resample. Contract prefers **client resamples to 16 kHz** for simplicity and consistent backend behavior.

**Contract:** Frontend sends **mono** PCM16LE at **16 kHz**, **250 ms** chunks (4000 samples = **8000 bytes**), `Content-Type: application/octet-stream`.

---

## 3. Chunk request: recording slot + seq + timestamp (out-of-order safety)

The same homework session has **two** recordings. The backend must know which one is streaming. HTTP responses can also arrive **out of order**; the frontend must ignore stale responses.

- **Recording slot:**  
  - **Parameter:** `recording_slot`. **Values:** `recording_1` (step 1) or `recording_2` (step 3).  
  - **Where:** Query param (e.g. `?recording_slot=recording_1`) or header (e.g. `X-Recording-Slot: recording_1`). Same on every chunk for that recording.

- **Chunk sequence (out-of-order / jitter):**  
  - **Request header:** `X-Chunk-Seq: <int>` — monotonic index for this recording (0, 1, 2, …).  
  - **Optional request header:** `X-Chunk-Start-Ms: <int>` — start time of this chunk in ms (or derived as `seq * chunk_ms`).  
  - **Response:** Backend **echoes `seq`** in the JSON. Frontend **ignores** any response whose `seq` is less than the latest already applied (drop stale responses). This prevents random glow jumps under network jitter.

**Contract:** Every chunk request includes `recording_slot` and `X-Chunk-Seq`; frontend only applies responses in order (or drops stale by `seq`).

---

## 4. Chunk endpoint: request / response (for BFF + frontend)

### 4.1 Request

- **URL:**  
  - Frontend: `POST /api/homework/session/:sessionId/process-chunk`.  
  - BFF proxies to backend: `POST /v2/homework/session/<session_id>/recording-metrics-chunk?recording_slot=recording_1` (or equivalent path; session + slot in URL or headers consistently).

- **Headers:**  
  - `Content-Type: application/octet-stream`.  
  - `X-Chunk-Seq: <int>` (monotonic per recording).  
  - Optional: `X-Chunk-Start-Ms: <int>`, `X-Audio-Sample-Rate: 16000`.

- **Body:** Binary PCM16LE, **mono**, 8000 bytes (250 ms at 16 kHz).

### 4.2 Response (JSON) — scores + signed deltas (direction)

Backend must return **both score and direction** so the frontend can map hue correctly (e.g. too fast → red, too slow → blue). Raw values alone are possible (Option B below), but the simplest stable contract is **score + signed delta** per metric.

**Recommended response shape:**

```json
{
  "seq": 42,
  "voiced_ratio": 0.83,

  "pacing_score": 0.72,
  "pacing_delta": 0.18,

  "intonation_score": 0.55,
  "intonation_delta": -0.40,

  "pause_score": 0.81,
  "pause_delta": 0.05
}
```

- **seq:** Echo of chunk index; frontend uses it to drop out-of-order responses.
- **voiced_ratio:** Fraction of the chunk that is voiced (e.g. 0–1). Used for **silence handling** (see §6).
- **Per-metric:**  
  - **\*_score:** 0–1 (1 = ideal).  
  - **\*_delta:** Signed deviation: &gt; 0 and &lt; 0 indicate **which** extreme (e.g. pacing_delta &gt; 0 ⇒ too fast, &lt; 0 ⇒ too slow). Exact semantics (e.g. WPM above/below ideal, or normalized) are backend-defined; frontend only needs sign and relative magnitude for hue.

**Alternative (Option B):** Backend returns only raw values (e.g. pacing WPM, intonation variability, pause ratio). Frontend then computes both score (band around ideal) and direction (above/below target) before color mapping. Contract prefers the **score + delta** shape above for clarity.

- **Stateless:** Backend does not store chunk state; each request is independent. Frontend is responsible for smoothing and ordering (seq).

---

## 5. Frontend smoothing (essential)

Backend is stateless, so metrics will be **jumpy** chunk-to-chunk. The frontend must smooth before driving the glow.

- **Rolling buffer:** Keep the last **N** metric frames (e.g. **N = 8** for 250 ms chunks ⇒ 2 seconds).
- **Aggregation:** Apply **EMA** (exponential moving average) or **simple rolling average** over that buffer before mapping metrics → color.
- **Update cadence:** On each chunk response, push new metrics into the buffer, compute smoothed values, then map to HSL/RGB and update the circle. Do not update the circle with raw chunk metrics.

**Contract:** Smoothing window = 8 frames (2 s at 250 ms chunks). Use EMA with alpha ≈ 0.2–0.3, or rolling mean over last 8 frames. Only apply responses whose `seq` is newer than the last applied; then push into buffer and smooth. Document in code which smoothing is used.

---

## 6. Silence handling (voiced_ratio)

If the chunk is mostly silence, the circle must **not** “punish” the user (e.g. flash red/grey for lack of speech).

- **Input:** Backend includes **voiced_ratio** in the response (e.g. 0–1; fraction of chunk that is voiced).
- **Threshold:** If `voiced_ratio < X` (e.g. **0.15**), treat as **silence/neutral**.
- **Behavior:**  
  - **Keep last color** or **fade slowly to neutral** (e.g. soft grey or last known good color at reduced brightness).  
  - **Do not** drive the circle to “bad” colors (red/blue/grey) from silence. Optionally do not push silence frames into the smoothing buffer, or push a neutral “ideal” frame so the buffer doesn’t fill with zeros.

**Contract:** If `voiced_ratio < 0.15` (or backend-defined threshold), frontend does not apply this chunk’s metrics to the dominant-issue logic; keep or fade to neutral only.

---

## 7. Color mapping: priority rule + direction (no muddy blending)

A single rule keeps the circle coherent. **Direction** (signed delta) is required so the frontend can choose the correct hue (e.g. red vs blue).

- **Scores and deltas:** Use backend’s `*_score` (0–1) and `*_delta` (signed). If backend sends only raw values, frontend computes score and direction (above/below target) before this step.
- **Dominant issue:** The **worst** dimension is the one with the **lowest** score.  
  - `dominant = argmin(pacing_score, intonation_score, pause_score)`.
- **Hue (from dominant + delta):**  
  - **Pacing worst:** `pacing_delta > 0` ⇒ **red** (too fast); `pacing_delta < 0` ⇒ **blue** (too slow).  
  - **Intonation worst:** `intonation_delta < 0` ⇒ **grey** (monotone); `intonation_delta > 0` ⇒ **purple** (or another hue for too chaotic).  
  - **Pause worst:** Use `pause_delta` to pick hue for “too few” vs “too many” (e.g. amber vs orange, or one hue with brightness encoding severity).  
  Exact HSL values are set in code; this defines the **logic**.
- **Brightness / saturation:** Use **overall score** (e.g. min or average of the three scores) for **brightness**: higher score ⇒ brighter/more saturated; lower ⇒ dimmer. Severity is clear without blending two hues.

**Contract:** No blending of two hues. Pick **one** dominant issue; use its **delta** for direction (which hue); use overall score for intensity/brightness.

---

## 8. Connection status indicator (recommended)

Real-time depends on network and backend latency. Add a small indicator so the user is not confused when the glow lags or chunks fail.

- **States:**  
  - **Live** (e.g. green dot): Chunks are being sent and responses received within a normal RTT.  
  - **Connecting…**: First chunk not yet acknowledged.  
  - **Delayed**: RTT above threshold (e.g. &gt; 1 s or &gt; 2 s); show a warning (e.g. amber dot or “Slow connection”).  
  - **Fallback:** On failure (network error or 5xx): keep **last known** glow color, show a small “Connection issue” or “Reconnecting…” so the user knows the glow is stale.

**Contract:** At least: **Live** vs **Connecting** vs **Error/stale** (show last glow + message). **Delayed** is optional but recommended.

---

## 9. Summary checklist

| Item | Contract |
|------|----------|
| Chunk format | **Mono** PCM16LE binary, `application/octet-stream`; 250 ms = 4000 samples = **8000 bytes**. |
| Sample rate | Client resamples to **16 kHz**; base64 only if backend cannot accept binary. |
| Recording slot | Send `recording_slot=recording_1` or `recording_2` (query or header) on every chunk. |
| Out-of-order | Request: `X-Chunk-Seq: <int>`; optional `X-Chunk-Start-Ms`. Response: echo `seq`; frontend ignores stale (seq &lt; last applied). |
| Response shape | `seq`, `voiced_ratio`, and per metric: `*_score` (0–1) + `*_delta` (signed for direction). |
| BFF → backend | e.g. `POST /v2/homework/session/<session_id>/recording-metrics-chunk?recording_slot=recording_1`. |
| Silence | If `voiced_ratio < 0.15`, keep last color or fade to neutral; do not show “bad” colors. |
| Smoothing | Rolling buffer of last 8 frames; apply only in-order (seq); EMA or rolling average before color. |
| Color rule | Dominant issue = lowest score; hue from that metric’s **delta** (e.g. pacing_delta &gt; 0 ⇒ red, &lt; 0 ⇒ blue); overall score → brightness; no blending. |
| Connection status | Live / Connecting / Error (and optionally Delayed); on error, keep last glow + message. |

This contract can be handed to the frontend implementer (or used to implement the glow) so the frontend and backend integrate without ambiguity.
